import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Map price IDs to plan names
const getPlanFromPriceId = (priceId: string): string => {
  const priceMap: Record<string, string> = {
    'price_1SZcgiCt9py6nUBqabHCq46B': 'basic',
    'price_1SZchCCt9py6nUBq9BzYm2BQ': 'pro',
    'price_1SZcicCt9py6nUBqmrGxge7L': 'pro',
  };
  return priceMap[priceId] || 'free';
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      logStep('ERROR: No stripe-signature header found');
      return new Response(JSON.stringify({ error: 'No signature' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logStep('ERROR: Webhook signature verification failed', { error: errorMessage });
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logStep('Event received', { type: event.type, id: event.id });

    switch (event.type) {
      // CRITICAL: Handle checkout completion to link user to customer
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const customerEmail = session.customer_email || session.customer_details?.email;
        const subscriptionId = session.subscription as string;

        logStep('Checkout completed', { customerId, customerEmail, subscriptionId });

        if (!customerEmail) {
          logStep('ERROR: No customer email in checkout session');
          break;
        }

        // Get the subscription details from Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price.id;
        const plan = getPlanFromPriceId(priceId);

        logStep('Subscription details', { subscriptionId, priceId, plan, status: subscription.status });

        // Find the user by email using auth admin
        const { data: users, error: userError } = await supabase.auth.admin.listUsers();
        
        if (userError) {
          logStep('ERROR: Failed to list users', { error: userError.message });
          break;
        }

        const user = users.users.find(u => u.email === customerEmail);
        
        if (!user) {
          logStep('ERROR: No user found for email', { email: customerEmail });
          break;
        }

        logStep('Found user', { userId: user.id, email: user.email });

        // Upsert the subscription
        const { error: upsertError } = await supabase
          .from('subscriptions')
          .upsert({
            user_id: user.id,
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
            plan,
            status: 'active',
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });

        if (upsertError) {
          logStep('ERROR: Failed to upsert subscription', { error: upsertError.message });
          throw upsertError;
        }

        logStep('SUCCESS: Subscription created/updated', { userId: user.id, plan });
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const priceId = subscription.items.data[0]?.price.id;
        const plan = getPlanFromPriceId(priceId);

        logStep('Subscription updated', { subscriptionId: subscription.id, customerId, plan, status: subscription.status });

        // Update by stripe_customer_id
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            stripe_subscription_id: subscription.id,
            plan,
            status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);

        if (updateError) {
          logStep('WARN: Failed to update by customer_id', { error: updateError.message });
        } else {
          logStep('SUCCESS: Subscription updated');
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        logStep('Subscription deleted', { subscriptionId: subscription.id, customerId });

        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: 'cancelled',
            plan: 'free',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);

        if (updateError) {
          logStep('ERROR: Failed to cancel subscription', { error: updateError.message });
        } else {
          logStep('SUCCESS: Subscription cancelled');
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const subscriptionId = invoice.subscription as string;

        if (subscriptionId) {
          logStep('Payment succeeded', { invoiceId: invoice.id, subscriptionId });
          
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price.id;
          const plan = getPlanFromPriceId(priceId);
          
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              status: 'active',
              plan,
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_customer_id', customerId);

          if (updateError) {
            logStep('ERROR: Failed to update after payment', { error: updateError.message });
          } else {
            logStep('SUCCESS: Subscription activated after payment');
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        logStep('Payment failed', { invoiceId: invoice.id, customerId });

        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);

        if (updateError) {
          logStep('ERROR: Failed to mark as past_due', { error: updateError.message });
        } else {
          logStep('SUCCESS: Subscription marked as past_due');
        }
        break;
      }

      default:
        logStep('Unhandled event type', { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logStep('ERROR: Processing webhook failed', { error: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
