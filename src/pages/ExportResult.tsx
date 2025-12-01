import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Download, Copy, ArrowLeft, ChevronDown, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import DOMPurify from "dompurify";

interface ExportData {
  id: string;
  title: string;
  html: string;
  markdown: string;
  description: string;
  slug: string;
  createdAt: string;
}

const ExportResult = () => {
  const [searchParams] = useSearchParams();
  const exportId = searchParams.get("id");
  const navigate = useNavigate();
  const { toast } = useToast();
  const [exportData, setExportData] = useState<ExportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    const fetchExport = async () => {
      if (!exportId) {
        navigate("/dashboard");
        return;
      }

      const { data, error } = await supabase
        .from("exports")
        .select("*")
        .eq("id", exportId)
        .maybeSingle();

      if (error || !data) {
        toast({
          title: "Error",
          description: "Failed to load export data",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setExportData({
        id: data.id,
        title: data.title || "Untitled",
        html: data.html_content || "",
        markdown: data.markdown_content || "",
        description: (data.frontmatter as any)?.description || "",
        slug: (data.frontmatter as any)?.slug || "",
        createdAt: data.created_at,
      });
      setLoading(false);
    };

    fetchExport();
  }, [exportId, navigate, toast]);

  const handleCopyHtml = () => {
    if (!exportData) return;

    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${exportData.description}">
  <title>${exportData.title}</title>
  <style>
    body {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    h1 { font-size: 2.5rem; margin-bottom: 1rem; }
    h2 { font-size: 2rem; margin-top: 2rem; margin-bottom: 1rem; }
    h3 { font-size: 1.5rem; margin-top: 1.5rem; margin-bottom: 0.75rem; }
    p { margin-bottom: 1rem; }
    img { max-width: 100%; height: auto; border-radius: 8px; margin: 1.5rem 0; }
    code { background: #f4f4f4; padding: 0.2rem 0.4rem; border-radius: 4px; }
    pre { background: #f4f4f4; padding: 1rem; border-radius: 8px; overflow-x: auto; }
    blockquote { border-left: 4px solid #ddd; padding-left: 1rem; margin: 1rem 0; color: #666; }
  </style>
</head>
<body>
  ${exportData.html}
</body>
</html>`;

    navigator.clipboard.writeText(fullHtml);
    toast({
      title: "Copied!",
      description: "HTML copied to clipboard",
    });
  };

  const handleCopyMarkdown = () => {
    if (!exportData) return;

    navigator.clipboard.writeText(exportData.markdown);
    toast({
      title: "Copied!",
      description: "Markdown copied to clipboard",
    });
  };

  const handleDownloadHtml = () => {
    if (!exportData) return;

    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${exportData.description}">
  <title>${exportData.title}</title>
  <style>
    body {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    h1 { font-size: 2.5rem; margin-bottom: 1rem; }
    h2 { font-size: 2rem; margin-top: 2rem; margin-bottom: 1rem; }
    h3 { font-size: 1.5rem; margin-top: 1.5rem; margin-bottom: 0.75rem; }
    p { margin-bottom: 1rem; }
    img { max-width: 100%; height: auto; border-radius: 8px; margin: 1.5rem 0; }
    code { background: #f4f4f4; padding: 0.2rem 0.4rem; border-radius: 4px; }
    pre { background: #f4f4f4; padding: 1rem; border-radius: 8px; overflow-x: auto; }
    blockquote { border-left: 4px solid #ddd; padding-left: 1rem; margin: 1rem 0; color: #666; }
  </style>
</head>
<body>
  ${exportData.html}
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportData.slug || "export"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded!",
      description: "HTML file saved to your device",
    });
  };

  const handleDownloadMarkdown = () => {
    if (!exportData) return;

    const blob = new Blob([exportData.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportData.slug || "export"}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded!",
      description: "Markdown file saved",
    });
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!exportData) return;

    try {
      const { error } = await supabase
        .from("exports")
        .delete()
        .eq("id", exportData.id);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: "Export has been deleted successfully",
      });

      navigate("/dashboard");
    } catch (error: any) {
      console.error("Delete error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete export",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <header className="border-b bg-background/95 backdrop-blur">
          <div className="container flex h-16 items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Notion to Blog</span>
          </div>
        </header>
        <div className="container py-8 max-w-6xl">
          <Skeleton className="h-12 w-64 mb-8" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!exportData) return null;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Notion to Blog</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Copy className="h-4 w-4" />
                  Copy
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background">
                <DropdownMenuItem onClick={handleCopyHtml}>
                  Copy HTML
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyMarkdown}>
                  Copy Markdown
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              onClick={handleDownloadHtml}
              className="gap-2 bg-gradient-hero"
            >
              <Download className="h-4 w-4" />
              Download HTML
            </Button>
            <Button
              onClick={handleDownloadMarkdown}
              variant="outline"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download Markdown
            </Button>
            <Button
              onClick={handleDeleteClick}
              variant="ghost"
              className="gap-2 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </header>

      <div className="container py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{exportData.title}</h1>
          <p className="text-muted-foreground">{exportData.description}</p>
        </div>

        <Card className="border-2 shadow-lg">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-slate max-w-none"
              style={{
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                lineHeight: "1.6",
              }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(exportData.html) }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this export?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete "{exportData.title}"
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

export default ExportResult;
