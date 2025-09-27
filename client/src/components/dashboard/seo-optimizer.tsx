import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Search, TrendingUp } from "lucide-react";

export function SEOOptimizer() {
  const keywords = [
    { keyword: "Omaha real estate", rank: 12, trend: "up" },
    { keyword: "Benson homes for sale", rank: 8, trend: "up" },
    { keyword: "Dundee neighborhood", rank: 15, trend: "down" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Search className="mr-2 h-5 w-5" />
          SEO Optimizer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall SEO Score</span>
            <span className="text-sm text-muted-foreground">87/100</span>
          </div>
          <Progress value={87} className="h-2" />
        </div>

        <div>
          <h4 className="text-sm font-medium mb-3">Keyword Rankings</h4>
          <div className="space-y-2">
            {keywords.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-2 border rounded">
                <div>
                  <div className="text-sm font-medium">{item.keyword}</div>
                  <div className="text-xs text-muted-foreground">Position #{item.rank}</div>
                </div>
                <Badge variant={item.trend === "up" ? "default" : "secondary"}>
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {item.trend}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}