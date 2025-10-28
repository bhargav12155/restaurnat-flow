import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Mic } from "lucide-react";

export function StreamingAvatar() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <User className="mr-2 h-5 w-5" />
          Streaming Avatar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center p-8 border-2 border-dashed border-muted rounded-lg">
          <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-4">
            Create AI-powered video avatars for real estate content
          </p>
          <Button>
            <Mic className="mr-2 h-4 w-4" />
            Create Avatar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}