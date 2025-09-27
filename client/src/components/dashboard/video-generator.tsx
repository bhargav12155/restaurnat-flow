import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Play } from "lucide-react";

export function VideoGenerator() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Video className="mr-2 h-5 w-5" />
          AI Video Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center p-8 border-2 border-dashed border-muted rounded-lg">
          <Play className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-4">
            Generate AI-powered video content for social media
          </p>
          <Button>
            <Video className="mr-2 h-4 w-4" />
            Create Video
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}