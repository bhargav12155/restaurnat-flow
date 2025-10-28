import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, TrendingUp, Home } from "lucide-react";

export function LocalMarketTools() {
  const neighborhoods = [
    {
      name: "Benson",
      avgPrice: "$245,000",
      trend: "up",
      change: "+5.2%",
      inventory: "Low"
    },
    {
      name: "Dundee", 
      avgPrice: "$380,000",
      trend: "up",
      change: "+3.8%",
      inventory: "Medium"
    },
    {
      name: "Blackstone",
      avgPrice: "$195,000", 
      trend: "up",
      change: "+7.1%",
      inventory: "High"
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <MapPin className="mr-2 h-5 w-5" />
          Omaha Market Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {neighborhoods.map((neighborhood, index) => (
            <div key={index} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium flex items-center">
                  <Home className="mr-1 h-4 w-4" />
                  {neighborhood.name}
                </h4>
                <Badge variant={neighborhood.trend === "up" ? "default" : "secondary"}>
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {neighborhood.change}
                </Badge>
              </div>
              <div className="text-lg font-semibold text-primary mb-1">
                {neighborhood.avgPrice}
              </div>
              <div className="text-xs text-muted-foreground">
                Inventory: {neighborhood.inventory}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}