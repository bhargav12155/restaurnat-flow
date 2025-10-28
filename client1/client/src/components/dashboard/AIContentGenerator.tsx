import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Wand2, Zap } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface GenerateContentRequest {
  contentType: string;
  propertyType?: string;
  neighborhood?: string;
  keywords?: string[];
  propertyFeatures?: string;
  propertyId?: string;
}

const contentTypes = [
  { id: 'social_post', name: 'Social Post', active: true },
  { id: 'blog_article', name: 'Blog Article', active: false },
  { id: 'property_description', name: 'Property Description', active: false },
  { id: 'email_campaign', name: 'Email Campaign', active: false },
];

const neighborhoods = [
  'Benson',
  'Dundee', 
  'Midtown',
  'West Omaha',
  'North Omaha',
  'South Omaha'
];

const propertyTypes = [
  'Single Family Home',
  'Condo',
  'Townhouse', 
  'Luxury Estate',
  'Investment Property'
];

export default function AIContentGenerator() {
  const [selectedType, setSelectedType] = useState('social_post');
  const [propertyType, setPropertyType] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [features, setFeatures] = useState('3 bedroom, 2 bathroom, updated kitchen, hardwood floors, first-time buyers');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    mutationFn: async (data: GenerateContentRequest) => {
      const response = await apiRequest('POST', '/api/ai/generate-content', data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Content Generated!",
        description: `AI has created your ${selectedType.replace('_', ' ')} content successfully.`,
      });
      // Invalidate activity query to show new activity
      queryClient.invalidateQueries({ queryKey: ['/api/activity'] });
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    const keywords = features.split(',').map(f => f.trim()).filter(Boolean);
    
    generateMutation.mutate({
      contentType: selectedType,
      propertyType: propertyType || undefined,
      neighborhood: neighborhood || undefined,
      keywords,
      propertyFeatures: features,
    });
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">AI Content Generator</CardTitle>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-muted-foreground">GPT-5 Ready</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Property Type</Label>
            <Select value={propertyType} onValueChange={setPropertyType}>
              <SelectTrigger>
                <SelectValue placeholder="Select property type" />
              </SelectTrigger>
              <SelectContent>
                {propertyTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Neighborhood</Label>
            <Select value={neighborhood} onValueChange={setNeighborhood}>
              <SelectTrigger>
                <SelectValue placeholder="Select neighborhood" />
              </SelectTrigger>
              <SelectContent>
                {neighborhoods.map((hood) => (
                  <SelectItem key={hood} value={hood}>
                    {hood}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>Content Type</Label>
          <div className="flex flex-wrap gap-2">
            {contentTypes.map((type) => (
              <Badge
                key={type.id}
                variant={selectedType === type.id ? "default" : "secondary"}
                className="cursor-pointer transition-colors"
                onClick={() => setSelectedType(type.id)}
              >
                {type.name}
              </Badge>
            ))}
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>Keywords & Features</Label>
          <Textarea
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
            placeholder="Enter property features, target keywords, or specific details..."
            rows={3}
          />
        </div>
        
        <Button 
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          className="w-full bg-gradient-to-r from-primary to-accent text-white hover:shadow-lg transition-all duration-200"
        >
          {generateMutation.isPending ? (
            <>
              <Zap className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 mr-2" />
              Generate AI Content
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
