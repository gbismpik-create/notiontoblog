import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      console.error('No stripe-signature header found');
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
      console.error('Webhook signature verification failed:', errorMessage);
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Webhook event received:', event.type);

    // Import Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.7');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle different event types
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        // Get the price to determine the plan
        const priceId = subscription.items.data[0]?.price.id;
        let plan = 'free';
        
        // Map price IDs to plan names
        if (priceId === 'price_1SZcgiCt9py6nUBqabHCq46B') {
          plan = 'basic';
        } else if (priceId === 'price_1SZchCCt9py6nUBq9BzYm2BQ' || priceId === 'price_1SZcicCt9py6nUBqmrGxge7L') {
          plan = 'pro';
        }

        console.log(`Processing subscription ${subscription.id} for customer ${customerId}, plan: ${plan}, status: ${subscription.status}`);

        // Find the user by stripe_customer_id
        const { data: existingSub, error: findError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('stripe_customer_id', customerId)
          .single();

        if (findError && findError.code !== 'PGRST116') {
          console.error('Error finding subscription:', findError);
          throw findError;
        }

        const subscriptionData = {
          stripe_subscription_id: subscription.id,
          stripe_customer_id: customerId,
          plan,
          status: subscription.status,
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (existingSub) {
          // Update existing subscription
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update(subscriptionData)
            .eq('id', existingSub.id);

          if (updateError) {
            console.error('Error updating subscription:', updateError);
            throw updateError;
          }
          console.log(`Updated subscription ${existingSub.id}`);
        } else {
          console.log('No existing subscription found for customer:', customerId);
          // Note: We can't create a new subscription here without knowing the user_id
          // This should be handled during checkout creation
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        console.log(`Deleting subscription ${subscription.id} for customer ${customerId}`);

        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: 'cancelled',
            plan: 'free',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);

        if (updateError) {
          console.error('Error cancelling subscription:', updateError);
          throw updateError;
        }
        console.log('Subscription cancelled and set to free plan');
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const subscriptionId = invoice.subscription as string;

        if (subscriptionId) {
          console.log(`Payment succeeded for subscription ${subscriptionId}`);
          
          // Fetch the subscription to get the current period end
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              status: 'active',
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_customer_id', customerId);

          if (updateError) {
            console.error('Error updating subscription after payment:', updateError);
            throw updateError;
          }
          console.log('Subscription updated after successful payment');
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        console.log(`Payment failed for customer ${customerId}`);

        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);

        if (updateError) {
          console.error('Error updating subscription after failed payment:', updateError);
          throw updateError;
        }
        console.log('Subscription marked as past_due');
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
