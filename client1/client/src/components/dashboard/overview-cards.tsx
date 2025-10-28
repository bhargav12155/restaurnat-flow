import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Users, FileText, Share2, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface DashboardMetrics {
  generatedContent: { value: number; change: string; };
  socialEngagement: { value: number; change: string; };
  seoScore: { value: number; change: string; };
  activeCampaigns: { value: number; change: string; };
}

export function OverviewCards() {
  const { data: metrics, isLoading, error } = useQuery<DashboardMetrics>({
    queryKey: ["/api/dashboard/metrics"],
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });

  const cards = [
    {
      key: "generatedContent",
      title: "Generated Content",
      value: metrics?.generatedContent?.value?.toString() || "0",
      change: metrics?.generatedContent?.change || "+0%",
      icon: FileText,
      trend: "up",
      dataTestId: "card-generated-content"
    },
    {
      key: "socialEngagement", 
      title: "Social Engagement",
      value: metrics?.socialEngagement?.value?.toString() || "0",
      change: metrics?.socialEngagement?.change || "+0%",
      icon: Share2,
      trend: "up",
      dataTestId: "card-social-engagement"
    },
    {
      key: "seoScore",
      title: "SEO Score",
      value: metrics?.seoScore?.value?.toString() || "0",
      change: metrics?.seoScore?.change || "+0%",
      icon: TrendingUp,
      trend: "up", 
      dataTestId: "card-seo-score"
    },
    {
      key: "activeCampaigns",
      title: "Active Campaigns",
      value: metrics?.activeCampaigns?.value?.toString() || "0",
      change: metrics?.activeCampaigns?.change || "+0",
      icon: Users,
      trend: "up",
      dataTestId: "card-active-campaigns"
    }
  ];

  // Loading state
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="col-span-full">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">Failed to load dashboard metrics. Please refresh the page.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        const isPositiveChange = card.change.startsWith('+');
        
        return (
          <Card key={card.key} data-testid={card.dataTestId}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={`${card.dataTestId}-value`}>
                {card.value}
              </div>
              <p className="text-xs text-muted-foreground">
                <span 
                  className={isPositiveChange ? "text-green-500" : "text-red-500"}
                  data-testid={`${card.dataTestId}-change`}
                >
                  {card.change}
                </span>{" "}
                from last month
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}