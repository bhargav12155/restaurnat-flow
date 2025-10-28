import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus } from "lucide-react";

export function TemplateManager() {
  const templates = [
    { name: "Open House Announcement", type: "Social Media", status: "Active" },
    { name: "New Listing Feature", type: "Blog Post", status: "Draft" },
    { name: "Market Update Email", type: "Email", status: "Active" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <FileText className="mr-2 h-5 w-5" />
          Template Manager
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {templates.map((template, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="text-sm font-medium">{template.name}</div>
                <div className="text-xs text-muted-foreground">{template.type}</div>
              </div>
              <Badge variant={template.status === "Active" ? "default" : "secondary"}>
                {template.status}
              </Badge>
            </div>
          ))}
        </div>
        <Button className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Create Template
        </Button>
      </CardContent>
    </Card>
  );
}