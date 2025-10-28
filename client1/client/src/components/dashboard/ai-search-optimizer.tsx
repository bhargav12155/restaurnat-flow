import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Search, Target } from "lucide-react";

export function AISearchOptimizer() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Search className="mr-2 h-5 w-5" />
          AI Search Optimizer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Search Performance</span>
            <span className="text-sm text-muted-foreground">78%</span>
          </div>
          <Progress value={78} className="h-2" />
        </div>
        <div className="flex items-center space-x-2 text-sm">
          <Target className="h-4 w-4 text-primary" />
          <span>Optimizing for Omaha real estate market</span>
        </div>
      </CardContent>
    </Card>
  );
}