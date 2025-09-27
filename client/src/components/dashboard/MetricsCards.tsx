import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Users, Heart, Home, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Metrics {
  totalLeads: number;
  socialEngagement: number;
  activeListings: number;
  seoScore: number;
}

export default function MetricsCards() {
  const { data: metrics, isLoading } = useQuery<Metrics>({
    queryKey: ['/api/dashboard/metrics'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6">
              <div className="h-20 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Total Leads",
      value: metrics?.totalLeads || 0,
      change: "+12% from last month",
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Social Engagement", 
      value: `${((metrics?.socialEngagement || 0) / 1000).toFixed(1)}K`,
      change: "+24% from last week",
      icon: Heart,
      color: "text-secondary",
      bgColor: "bg-secondary/10",
    },
    {
      title: "Active Listings",
      value: metrics?.activeListings || 0,
      change: "3 new this week",
      icon: Home,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "SEO Score",
      value: metrics?.seoScore || 0,
      change: "Excellent rating",
      icon: Search,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className="animate-fade-in">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">{card.title}</p>
                  <p className="text-3xl font-bold text-foreground mt-2">
                    {card.value}
                  </p>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="w-3 h-3 text-green-500 mr-1" />
                    <span className="text-green-500 text-sm font-medium">{card.change}</span>
                  </div>
                </div>
                <div className={`w-12 h-12 ${card.bgColor} rounded-xl flex items-center justify-center`}>
                  <Icon className={`${card.color} w-6 h-6`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
