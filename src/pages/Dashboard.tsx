import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, LogOut, Settings, Upload, Clock, FileText, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [notionUrl, setNotionUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [exports, setExports] = useState<any[]>([]);
  const [exportCount, setExportCount] = useState(0);
  const [subscription, setSubscription] = useState<any>(null);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [exportToDelete, setExportToDelete] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const checkSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (!error && data) {
        setSubscription(data);
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      
      // Check subscription
      await checkSubscription();
      
      // Fetch exports
      const { data: exportsData } = await supabase
        .from("exports")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (exportsData) {
        setExports(exportsData);
        setIsFirstTime(exportsData.length === 0);
      }

      // Count this month's exports
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from("exports")
        .select("*", { count: "exact", head: true })
        .eq("user_id", session.user.id)
        .gte("created_at", startOfMonth.toISOString());

      setExportCount(count || 0);
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleDeleteClick = (exportId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExportToDelete(exportId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!exportToDelete) return;

    try {
      const { error } = await supabase
        .from("exports")
        .delete()
        .eq("id", exportToDelete);

      if (error) throw error;

      setExports(exports.filter(exp => exp.id !== exportToDelete));
      
      toast({
        title: "Deleted",
        description: "Export has been deleted successfully",
      });
    } catch (error: any) {
      console.error("Delete error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete export",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setExportToDelete(null);
    }
  };

  const handleExport = async () => {
    if (!notionUrl) {
      toast({
        title: "Error",
        description: "Please enter a Notion URL",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Error",
          description: "Please sign in to continue",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase.functions.invoke("convert-notion", {
        body: { notionUrl },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 800);
      
      toast({
        title: "Success!",
        description: "Your Notion page has been converted",
      });

      // Navigate to result page
      setTimeout(() => {
        navigate(`/export-result?id=${data.id}`);
      }, 800);
    } catch (error: any) {
      console.error("Export error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to convert Notion page",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  if (!user) return null;

  const plan = subscription?.plan || 'free';
  const maxExports = plan === 'pro' ? 'Unlimited' : plan === 'basic' ? 20 : 5;
  const maxExportsNum = plan === 'pro' ? 999 : plan === 'basic' ? 20 : 5;
  const progressPercent = (exportCount / maxExportsNum) * 100;
  
  // Extract first name from email or user metadata
  const getUserFirstName = () => {
    if (user.user_metadata?.full_name) {
      return user.user_metadata.full_name.split(' ')[0];
    }
    return null;
  };
  
  const firstName = getUserFirstName();

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Notion to Blog</span>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant={plan === 'pro' ? 'default' : plan === 'basic' ? 'secondary' : 'outline'}>
              {plan.charAt(0).toUpperCase() + plan.slice(1)} Plan
            </Badge>
            <Link to="/settings">
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Welcome Section */}
          <div className="space-y-4">
            {isFirstTime ? (
              <>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold">
                  Welcome! 👋
                </h1>
                <p className="text-lg sm:text-xl text-muted-foreground">
                  Let's turn your first Notion page into a blog post
                </p>
              </>
            ) : (
              <>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold">
                  Welcome back{firstName ? `, ${firstName}` : ''}! 👋
                </h1>
                <p className="text-lg sm:text-xl text-muted-foreground">
                  Ready to convert another Notion page?
                </p>
              </>
            )}
            
            {/* Usage Counter */}
            <div className="pt-2">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                {exportCount} of {maxExports} {plan === 'free' ? 'free ' : ''}exports used this month{plan === 'free' ? ' — upgrade for unlimited' : ''}
              </p>
              <Progress value={progressPercent} className="h-2" />
            </div>
          </div>

          {/* Main Export Card */}
          <Card className="border-2 shadow-lg bg-gradient-card relative overflow-hidden">
            {showSuccess && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10 animate-confetti pointer-events-none">
                <Sparkles className="h-16 w-16 text-accent" />
              </div>
            )}
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
                <Upload className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                Convert Notion Page
              </CardTitle>
              <CardDescription className="text-base">
                Paste any public Notion page URL to get started
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  placeholder="https://notion.so/your-page-id"
                  value={notionUrl}
                  onChange={(e) => setNotionUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleExport()}
                  className="flex-1 h-12 text-base"
                />
                <Button 
                  onClick={handleExport} 
                  disabled={loading}
                  className={`bg-gradient-convert shadow-md hover:shadow-glow transition-all h-12 px-8 font-semibold text-base w-full sm:w-auto ${notionUrl && !loading ? 'animate-pulse' : ''}`}
                >
                  {loading ? "Converting..." : "Convert"}
                </Button>
              </div>
              {plan === 'free' && (
                <div className="pt-2">
                  <Link to="/settings">
                    <Button className="w-full bg-gradient-upgrade shadow-md hover:shadow-upgrade transition-all h-12 font-semibold">
                      Upgrade to Pro - Unlimited Exports
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Export History */}
          <Card className="border-2 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileText className="h-5 w-5" />
                Recent Exports
              </CardTitle>
              <CardDescription>Your conversion history</CardDescription>
            </CardHeader>
            <CardContent>
              {exports.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="font-medium text-lg mb-1">No exports yet</p>
                  <p className="text-sm">Your converted pages will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {exports.map((exp) => (
                    <div
                      key={exp.id}
                      className="group flex items-center justify-between p-4 border-2 rounded-xl hover:border-primary hover:shadow-md transition-all cursor-pointer bg-gradient-card"
                      onClick={() => navigate(`/export-result?id=${exp.id}`)}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-base truncate">{exp.title || "Untitled"}</h4>
                          <p className="text-sm text-muted-foreground">
                            {new Date(exp.created_at).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric' 
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge 
                          variant={exp.status === "completed" ? "default" : "secondary"}
                        >
                          {exp.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleDeleteClick(exp.id, e)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the export
              and remove it from your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
