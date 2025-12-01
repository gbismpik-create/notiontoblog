import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Download, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const Landing = () => {
  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Notion to Blog</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button className="bg-gradient-hero shadow-md hover:shadow-lg transition-all">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container py-24 md:py-32 lg:py-40">
        <div className="mx-auto max-w-4xl text-center space-y-8">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
            Turn Any Notion Page into a Perfect SEO Blog Post in{" "}
            <span className="bg-gradient-hero bg-clip-text text-transparent">4 Clicks</span>
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-3xl mx-auto px-4">
            No formatting hell. No copy-paste. Just paste your Notion URL → get beautiful HTML ready to publish.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
            <Link to="/auth">
              <Button size="lg" className="bg-gradient-hero shadow-lg hover:shadow-glow transition-all text-lg h-14 px-10 w-full sm:w-auto font-semibold">
                Start for Free - 5 Exports
              </Button>
            </Link>
          </div>
          
          {/* 3 Benefit Cards */}
          <div className="grid sm:grid-cols-3 gap-4 pt-12 max-w-3xl mx-auto">
            <Card className="border-2 bg-gradient-card shadow-md hover:shadow-lg transition-all p-6">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mb-2">
                  <Zap className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-bold text-lg">Fast</h3>
                <p className="text-sm text-muted-foreground">Convert in under 4 seconds</p>
              </div>
            </Card>
            <Card className="border-2 bg-gradient-card shadow-md hover:shadow-lg transition-all p-6">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-bold text-lg">SEO-ready</h3>
                <p className="text-sm text-muted-foreground">AI-optimized titles & meta</p>
              </div>
            </Card>
            <Card className="border-2 bg-gradient-card shadow-md hover:shadow-lg transition-all p-6">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mb-2">
                  <Download className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-bold text-lg">Mobile perfect</h3>
                <p className="text-sm text-muted-foreground">Responsive everywhere</p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container py-24 border-t">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl font-bold">Everything You Need</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Professional blog conversion tools powered by AI
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="border-2 bg-gradient-card shadow-md hover:shadow-lg transition-all">
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>AI-Powered SEO</CardTitle>
              <CardDescription>
                Automatically generate perfect titles and meta descriptions optimized for search engines
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 bg-gradient-card shadow-md hover:shadow-lg transition-all">
            <CardHeader>
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-accent" />
              </div>
              <CardTitle>Lightning Fast</CardTitle>
              <CardDescription>
                Convert entire Notion pages in seconds with proper formatting and structure intact
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 bg-gradient-card shadow-md hover:shadow-lg transition-all">
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Download className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Multiple Formats</CardTitle>
              <CardDescription>
                Export to Markdown or HTML with images automatically downloaded and rehosted
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="container py-24 border-t">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl font-bold">Simple, Transparent Pricing</h2>
          <p className="text-xl text-muted-foreground">
            Choose the plan that fits your needs
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Card className="border-2 bg-gradient-card shadow-md hover:shadow-lg transition-all">
            <CardHeader>
              <CardTitle className="text-2xl">Basic</CardTitle>
              <div className="mt-4">
                <span className="text-5xl font-bold">$9</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <CardDescription className="text-base mt-2">
                Perfect for personal blogs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {[
                  "20 exports per month",
                  "AI-powered SEO",
                  "Markdown & HTML export",
                  "Image rehosting",
                  "Email support"
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-accent flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link to="/auth" className="block">
                <Button className="w-full" variant="outline" size="lg">
                  Get Started
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-2 border-primary bg-gradient-card shadow-lg hover:shadow-glow transition-all relative overflow-hidden">
            <div className="absolute top-4 right-4">
              <Badge className="bg-gradient-hero">Most Popular</Badge>
            </div>
            <CardHeader>
              <CardTitle className="text-2xl">Pro</CardTitle>
              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold">$19</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xl text-muted-foreground">or $190/year</span>
                  <Badge variant="secondary" className="text-xs">Save $38</Badge>
                </div>
              </div>
              <CardDescription className="text-base mt-2">
                For professional content creators
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {[
                  "Unlimited exports",
                  "AI-powered SEO",
                  "Markdown & HTML export",
                  "Image rehosting",
                  "Priority support",
                  "Custom templates",
                  "API access"
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-accent flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link to="/auth" className="block">
                <Button className="w-full bg-gradient-hero shadow-md hover:shadow-lg" size="lg">
                  Start Pro Trial
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container py-24 border-t">
        <div className="bg-gradient-hero rounded-2xl p-12 text-center text-primary-foreground shadow-lg">
          <h2 className="text-4xl font-bold mb-4">Ready to Transform Your Notion Pages?</h2>
          <p className="text-xl mb-8 opacity-90">
            Start converting your Notion content into beautiful blog posts today
          </p>
          <Link to="/auth">
            <Button size="lg" variant="secondary" className="text-lg h-12 px-8 shadow-md hover:shadow-lg">
              Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container text-center text-muted-foreground">
          <p>&copy; 2024 Notion to Blog. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
