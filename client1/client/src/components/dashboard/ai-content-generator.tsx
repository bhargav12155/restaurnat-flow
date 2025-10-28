import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Brain, FileText, Copy, CheckCircle } from "lucide-react";
import { z } from "zod";
import { useState } from "react";

const aiContentSchema = z.object({
  contentType: z.string().min(1, "Content type is required"),
  neighborhood: z.string().optional(),
  keywords: z.string().min(5, "Please provide at least 5 characters of keywords"),
  propertyType: z.string().optional(),
  propertyFeatures: z.string().optional(),
});

type AIContentFormData = z.infer<typeof aiContentSchema>;

interface AIContentGeneratorProps {
  isGenerating: boolean;
}

export function AIContentGenerator({ isGenerating: externalGenerating }: AIContentGeneratorProps) {
  const [generatedContent, setGeneratedContent] = useState<string>("");
  const [contentTitle, setContentTitle] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AIContentFormData>({
    resolver: zodResolver(aiContentSchema),
    defaultValues: {
      contentType: "",
      neighborhood: "",
      keywords: "",
      propertyType: "",
      propertyFeatures: "",
    },
  });

  const generateContentMutation = useMutation({
    mutationFn: async (data: AIContentFormData) => {
      const response = await apiRequest("POST", "/api/ai/generate-content", data);
      return response.json();
    },
    onSuccess: (result) => {
      setGeneratedContent(result.content || "Generated content will appear here...");
      setContentTitle(result.title || "AI Generated Content");
      toast({
        title: "Content Generated Successfully!",
        description: "Your AI-powered content is ready to use.",
      });
      // Invalidate and refetch AI content list
      queryClient.invalidateQueries({ queryKey: ["/api/ai/content"] });
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate content. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AIContentFormData) => {
    generateContentMutation.mutate(data);
  };

  const copyToClipboard = () => {
    if (generatedContent) {
      navigator.clipboard.writeText(generatedContent);
      setCopied(true);
      toast({
        title: "Copied to Clipboard!",
        description: "Content has been copied to your clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isGenerating = generateContentMutation.isPending || externalGenerating;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Brain className="mr-2 h-5 w-5" />
          AI Content Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="contentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-content-type">
                        <SelectValue placeholder="Select content type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="social-post">Social Media Post</SelectItem>
                      <SelectItem value="blog-article">Blog Article</SelectItem>
                      <SelectItem value="property-description">Property Description</SelectItem>
                      <SelectItem value="email-campaign">Email Campaign</SelectItem>
                      <SelectItem value="market-update">Market Update</SelectItem>
                      <SelectItem value="listing-description">Listing Description</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="neighborhood"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Omaha Neighborhood (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-neighborhood">
                        <SelectValue placeholder="Select Omaha neighborhood" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="benson">Benson</SelectItem>
                      <SelectItem value="dundee">Dundee</SelectItem>
                      <SelectItem value="blackstone">Blackstone District</SelectItem>
                      <SelectItem value="midtown">Midtown Crossing</SelectItem>
                      <SelectItem value="old-market">Old Market</SelectItem>
                      <SelectItem value="aksarben">Aksarben Village</SelectItem>
                      <SelectItem value="west-omaha">West Omaha</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="propertyType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property Type (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g. Single family, Condo, Townhouse..." 
                      {...field} 
                      data-testid="input-property-type"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="keywords"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Keywords & Details</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter property details, keywords, or topic information..."
                      className="min-h-20"
                      {...field}
                      data-testid="textarea-keywords"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="propertyFeatures"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property Features (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="e.g. Updated kitchen, hardwood floors, fenced yard..."
                      className="min-h-16"
                      {...field}
                      data-testid="textarea-features"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              disabled={isGenerating} 
              className="w-full"
              data-testid="button-generate-ai-content"
            >
              <FileText className="mr-2 h-4 w-4" />
              {isGenerating ? "Generating..." : "Generate AI Content"}
            </Button>
          </form>
        </Form>

        {/* Generated Content Preview */}
        <div className="mt-4 p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium">{contentTitle || "Generated Content Preview"}</h4>
            {generatedContent && (
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                className="text-xs"
                data-testid="button-copy-content"
              >
                {copied ? (
                  <CheckCircle className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copied ? "Copied!" : "Copy"}
              </Button>
            )}
          </div>
          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
            {generatedContent || "AI-generated content will appear here..."}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}