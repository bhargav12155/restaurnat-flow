import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { 
  Home, 
  Bot, 
  TrendingUp, 
  Users, 
  Zap, 
  BarChart3, 
  Calendar,
  Video
} from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "AI Content Generation",
    description: "GPT-5 powered content creation tailored for Omaha real estate market",
    color: "text-primary",
    bgColor: "bg-primary/10"
  },
  {
    icon: TrendingUp,
    title: "Social Media Management",
    description: "Multi-platform posting to Facebook, Instagram, Twitter, and YouTube",
    color: "text-secondary",
    bgColor: "bg-secondary/10"
  },
  {
    icon: BarChart3,
    title: "SEO Analytics",
    description: "Real-time performance monitoring and keyword tracking",
    color: "text-accent",
    bgColor: "bg-accent/10"
  },
  {
    icon: Calendar,
    title: "Content Calendar",
    description: "Advanced scheduling and content planning tools",
    color: "text-green-500",
    bgColor: "bg-green-500/10"
  },
  {
    icon: Video,
    title: "Video Generation",
    description: "AI-powered video content with HeyGen integration",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10"
  },
  {
    icon: Users,
    title: "Lead Management",
    description: "Track and nurture leads across all marketing channels",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10"
  }
];

export default function Landing() {
  const { toast } = useToast();

  useEffect(() => {
    // Check if user was redirected due to authentication error
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    
    if (error === 'unauthorized') {
      toast({
        title: "Authentication Required",
        description: "Please log in to access the dashboard",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleLogin = () => {
    // Redirect to Replit Auth login
    window.location.href = '/api/login';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-primary/5" data-testid="landing-page">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Home className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">RealtyFlow</h1>
                <p className="text-sm text-muted-foreground">AI Marketing Suite</p>
              </div>
            </div>
            
            <Button 
              onClick={handleLogin}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              data-testid="login-button"
            >
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-16 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="space-y-4">
            <h2 className="text-5xl font-bold text-foreground leading-tight">
              AI-Powered Real Estate Marketing for 
              <span className="text-primary"> Omaha</span>
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Automate content creation, manage social media, optimize SEO, and generate leads 
              with our comprehensive marketing dashboard designed specifically for Omaha real estate professionals.
            </p>
          </div>
          
          <div className="flex items-center justify-center space-x-4">
            <Button 
              onClick={handleLogin}
              size="lg"
              className="bg-gradient-to-r from-primary to-accent text-white hover:shadow-lg transition-all duration-200"
              data-testid="hero-cta-button"
            >
              <Zap className="w-5 h-5 mr-2" />
              Start Creating Content
            </Button>
            
            <Button 
              variant="outline" 
              size="lg"
              className="border-primary text-primary hover:bg-primary/5"
            >
              Watch Demo
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="flex items-center justify-center space-x-8 pt-8 text-muted-foreground">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm">GPT-5 Powered</span>
            </div>
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span className="text-sm">200+ Agents</span>
            </div>
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">50M+ Impressions</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-foreground mb-4">
              Everything You Need to Dominate Omaha Real Estate
            </h3>
            <p className="text-lg text-muted-foreground">
              From Benson to Dundee, West Omaha to Midtown - our AI knows your market
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="animate-fade-in border-border hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className={`w-12 h-12 ${feature.bgColor} rounded-xl flex items-center justify-center mb-4`}>
                      <Icon className={`w-6 h-6 ${feature.color}`} />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-card border-t border-border">
        <div className="container mx-auto px-6 py-16 text-center">
          <div className="max-w-3xl mx-auto space-y-8">
            <h3 className="text-3xl font-bold text-foreground">
              Ready to Transform Your Real Estate Marketing?
            </h3>
            <p className="text-lg text-muted-foreground">
              Join hundreds of successful Omaha real estate professionals who are already using RealtyFlow 
              to generate more leads, create better content, and close more deals.
            </p>
            
            <div className="space-y-4">
              <Button 
                onClick={handleLogin}
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8"
                data-testid="footer-cta-button"
              >
                Get Started Free
              </Button>
              <p className="text-sm text-muted-foreground">
                No credit card required • 14-day free trial • Cancel anytime
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Home className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-foreground">RealtyFlow</span>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Built for Omaha real estate professionals by Mike Bjork & The Bjork Group
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
