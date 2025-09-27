import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Key, Eye, EyeOff } from "lucide-react";

export function APIKeyManager() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Key className="mr-2 h-5 w-5" />
          API Key Manager
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <div className="text-sm font-medium">OpenAI API</div>
              <div className="text-xs text-muted-foreground">sk-***••••••••••••••••••••••••</div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="default">Active</Badge>
              <Button size="sm" variant="outline">
                <Eye className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
        <Button className="w-full">Add New API Key</Button>
      </CardContent>
    </Card>
  );
}