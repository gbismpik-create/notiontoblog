import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowLeft, CreditCard, User, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const PRICE_IDS = {
  basic: 'price_1SZAQCCt9py6nUBqxiye8x6k',
  pro: 'price_1SZAUBCt9py6nUBqTpRvNoY0',
};

const Settings = () => {
  const [user, setUser] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [exportCount, setExportCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const checkSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) throw error;
      setSubscription(data);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const fetchExportCount = async (userId: string) => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from('exports')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString());

    setExportCount(count || 0);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      await checkSubscription();
      await fetchExportCount(session.user.id);
    };
    init();
  }, [navigate]);

  const handleUpgrade = async (priceId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to start checkout');
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Portal error:', error);
      toast.error('Failed to open customer portal');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const plan = subscription?.plan || 'free';
  const isSubscribed = subscription?.subscribed || false;
  const maxExports = plan === 'pro' ? 'Unlimited' : plan === 'basic' ? 20 : 5;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">Notion to Blog</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Settings</h1>
            <p className="text-muted-foreground">Manage your account and billing</p>
          </div>

          <Tabs defaultValue="account" className="space-y-6">
            <TabsList>
              <TabsTrigger value="account">
                <User className="h-4 w-4 mr-2" />
                Account
              </TabsTrigger>
              <TabsTrigger value="billing">
                <CreditCard className="h-4 w-4 mr-2" />
                Billing
              </TabsTrigger>
            </TabsList>

            <TabsContent value="account" className="space-y-4">
              <Card className="border-2">
                <CardHeader>
                  <CardTitle>Account Information</CardTitle>
                  <CardDescription>Your account details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Email</label>
                    <p className="text-muted-foreground">{user.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Account Created</label>
                    <p className="text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="billing" className="space-y-4">
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Current Plan
                    <Badge variant={plan === 'pro' ? 'default' : plan === 'basic' ? 'secondary' : 'outline'}>
                      {plan.charAt(0).toUpperCase() + plan.slice(1)}
                    </Badge>
                  </CardTitle>
                  <CardDescription>Manage your subscription</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {plan === 'free' && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        You're currently on the free plan with 5 exports per month.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleUpgrade(PRICE_IDS.basic)}
                          disabled={loading}
                          variant="outline"
                        >
                          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Upgrade to Basic - $9/month
                        </Button>
                        <Button
                          onClick={() => handleUpgrade(PRICE_IDS.pro)}
                          disabled={loading}
                          className="bg-gradient-hero shadow-md hover:shadow-lg"
                        >
                          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Upgrade to Pro - $19/month
                        </Button>
                      </div>
                    </div>
                  )}
                  {plan === 'basic' && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        You're on the Basic plan with 20 exports per month.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleUpgrade(PRICE_IDS.pro)}
                          disabled={loading}
                          className="bg-gradient-hero shadow-md hover:shadow-lg"
                        >
                          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Upgrade to Pro - $19/month
                        </Button>
                        <Button
                          onClick={handleManageSubscription}
                          disabled={loading}
                          variant="outline"
                        >
                          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Manage Subscription
                        </Button>
                      </div>
                    </div>
                  )}
                  {plan === 'pro' && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        You're on the Pro plan with unlimited exports.
                      </p>
                      <Button
                        onClick={handleManageSubscription}
                        disabled={loading}
                        variant="outline"
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Manage Subscription
                      </Button>
                    </div>
                  )}
                  {subscription?.subscription_end && (
                    <p className="text-xs text-muted-foreground">
                      Next billing date: {new Date(subscription.subscription_end).toLocaleDateString()}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-2">
                <CardHeader>
                  <CardTitle>Usage This Month</CardTitle>
                  <CardDescription>Track your export usage</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Exports Used</span>
                      <span className="font-medium">
                        {exportCount} / {maxExports}
                      </span>
                    </div>
                    {typeof maxExports === 'number' && (
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${Math.min((exportCount / maxExports) * 100, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Settings;
