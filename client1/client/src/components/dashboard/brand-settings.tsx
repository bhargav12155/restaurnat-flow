import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Upload } from "lucide-react";

export function BrandSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings className="mr-2 h-5 w-5" />
          Brand Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="brand-name">Brand Name</Label>
          <Input id="brand-name" placeholder="Your Real Estate Brand" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="brand-tagline">Tagline</Label>
          <Input id="brand-tagline" placeholder="Your brand tagline" />
        </div>
        <div className="space-y-2">
          <Label>Logo</Label>
          <Button variant="outline" className="w-full">
            <Upload className="mr-2 h-4 w-4" />
            Upload Logo
          </Button>
        </div>
        <Button className="w-full">Save Settings</Button>
      </CardContent>
    </Card>
  );
}