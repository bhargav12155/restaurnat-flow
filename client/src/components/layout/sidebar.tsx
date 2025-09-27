import { Button } from "@/components/ui/button";
import { Home, Brain, Share2, Search, Calendar, MapPin, Settings, BarChart3 } from "lucide-react";

interface SidebarProps {
  activeView: string;
}

export function Sidebar({ activeView }: SidebarProps) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "ai-content", label: "AI Content", icon: Brain },
    { id: "social", label: "Social Media", icon: Share2 },
    { id: "seo", label: "SEO", icon: Search },
    { id: "calendar", label: "Calendar", icon: Calendar },
    { id: "market", label: "Market", icon: MapPin },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "brand-settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside className="w-64 bg-card border-r border-border p-6">
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-foreground">RealtyFlow</h2>
        <p className="text-sm text-muted-foreground">AI Marketing Suite</p>
      </div>
      <nav className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          
          return (
            <Button
              key={item.id}
              variant={isActive ? "secondary" : "ghost"}
              className={`w-full justify-start ${isActive ? 'bg-primary text-primary-foreground' : ''}`}
              onClick={() => window.location.hash = item.id}
            >
              <Icon className="mr-2 h-4 w-4" />
              {item.label}
            </Button>
          );
        })}
      </nav>
    </aside>
  );
}