import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Plus } from "lucide-react";

export function PhotoAvatarManager() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Camera className="mr-2 h-5 w-5" />
          Photo Avatar Manager
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center p-8 border-2 border-dashed border-muted rounded-lg">
          <Camera className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-4">
            Manage your photo avatars for personalized content
          </p>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Photo Avatar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}