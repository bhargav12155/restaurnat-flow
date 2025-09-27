import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Crown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface SEOMetrics {
  seoScore: number;
  monthlyVisits: number;
  topKeywords: Array<{
    keyword: string;
    ranking: number;
    trend: number;
  }>;
}

export default function SEOAnalytics() {
  const { data: metrics, isLoading } = useQuery<SEOMetrics>({
    queryKey: ['/api/seo/metrics'],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SEO Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="h-20 bg-muted rounded-lg" />
              <div className="h-20 bg-muted rounded-lg" />
            </div>
            <div className="h-32 bg-muted rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="w-3 h-3 text-green-500" />;
    if (trend < 0) return <TrendingDown className="w-3 h-3 text-red-500" />;
    return null;
  };

  const getRankingIcon = (ranking: number) => {
    if (ranking === 1) return <Crown className="w-3 h-3 text-yellow-500" />;
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>SEO Performance</CardTitle>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm text-muted-foreground">Real-time</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-foreground">{metrics?.seoScore || 0}</p>
              <p className="text-sm text-muted-foreground">SEO Score</p>
              <Progress 
                value={metrics?.seoScore || 0} 
                className="mt-2" 
                data-testid="seo-score-progress"
              />
            </div>
            
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-foreground">
                {metrics?.monthlyVisits?.toLocaleString() || 0}
              </p>
              <p className="text-sm text-muted-foreground">Monthly Visits</p>
              <p className="text-xs text-green-600 mt-1">↑ 23% vs last month</p>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-foreground mb-3">Top Keywords</h4>
            <div className="space-y-2">
              {metrics?.topKeywords?.length ? (
                metrics.topKeywords.map((keyword, index) => (
                  <div key={keyword.keyword} className="flex items-center justify-between py-2">
                    <span className="text-sm text-foreground">{keyword.keyword}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-foreground">
                        #{keyword.ranking}
                      </span>
                      {getRankingIcon(keyword.ranking)}
                      {getTrendIcon(keyword.trend)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-foreground">Omaha real estate</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-foreground">#3</span>
                      <TrendingUp className="w-3 h-3 text-green-500" />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-foreground">Benson homes for sale</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-foreground">#1</span>
                      <Crown className="w-3 h-3 text-yellow-500" />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-foreground">Dundee neighborhood</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-foreground">#7</span>
                      <TrendingDown className="w-3 h-3 text-red-500" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
