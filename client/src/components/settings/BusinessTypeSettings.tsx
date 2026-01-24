import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, ChefHat, Wrench, Home, Briefcase, Store } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBusinessType } from "@/hooks/useBusinessType";

interface BusinessTypeConfig {
  id: string;
  label: string;
  icon: any;
  subtypes: { id: string; label: string; }[];
}

const BUSINESS_TYPES: BusinessTypeConfig[] = [
  {
    id: "restaurant",
    label: "Restaurant & Food Service",
    icon: ChefHat,
    subtypes: [
      { id: "fine_dining", label: "Fine Dining" },
      { id: "fast_casual", label: "Fast Casual" },
      { id: "cafe", label: "Café & Coffee Shop" },
      { id: "bar_pub", label: "Bar & Pub" },
      { id: "food_truck", label: "Food Truck" },
      { id: "catering", label: "Catering Service" },
      { id: "bakery", label: "Bakery" },
      { id: "quick_service", label: "Quick Service (QSR)" },
    ]
  },
  {
    id: "home_services",
    label: "Home Services",
    icon: Wrench,
    subtypes: [
      { id: "plumbing", label: "Plumbing" },
      { id: "hvac", label: "HVAC" },
      { id: "electrical", label: "Electrical" },
      { id: "cleaning", label: "Cleaning Service" },
      { id: "landscaping", label: "Landscaping" },
      { id: "roofing", label: "Roofing" },
      { id: "painting", label: "Painting" },
      { id: "handyman", label: "Handyman" },
    ]
  },
  {
    id: "real_estate",
    label: "Real Estate",
    icon: Home,
    subtypes: [
      { id: "residential", label: "Residential Sales" },
      { id: "commercial", label: "Commercial Real Estate" },
      { id: "property_management", label: "Property Management" },
      { id: "rental", label: "Rental Services" },
      { id: "investment", label: "Investment Properties" },
    ]
  },
  {
    id: "retail",
    label: "Retail & E-commerce",
    icon: Store,
    subtypes: [
      { id: "fashion", label: "Fashion & Apparel" },
      { id: "electronics", label: "Electronics" },
      { id: "beauty", label: "Beauty & Cosmetics" },
      { id: "sports", label: "Sports & Fitness" },
      { id: "home_goods", label: "Home Goods" },
      { id: "specialty", label: "Specialty Store" },
    ]
  },
  {
    id: "professional_services",
    label: "Professional Services",
    icon: Briefcase,
    subtypes: [
      { id: "legal", label: "Legal Services" },
      { id: "accounting", label: "Accounting & Tax" },
      { id: "consulting", label: "Consulting" },
      { id: "marketing", label: "Marketing Agency" },
      { id: "insurance", label: "Insurance" },
      { id: "financial", label: "Financial Services" },
    ]
  },
  {
    id: "general",
    label: "General Business",
    icon: Building2,
    subtypes: [
      { id: "other", label: "Other" },
    ]
  }
];

export function BusinessTypeSettings() {
  const { toast } = useToast();
  const { data, isLoading: isFetching, isRefetching, refetch, updateCache } = useBusinessType();
  const [businessType, setBusinessType] = useState<string>("restaurant");
  const [businessSubtype, setBusinessSubtype] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setBusinessType(data.businessType || "restaurant");
      setBusinessSubtype(data.businessSubtype || "");
    }
  }, [data]);

  const selectedBusinessConfig = BUSINESS_TYPES.find(bt => bt.id === businessType);
  const IconComponent = selectedBusinessConfig?.icon || Building2;

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      const response = await fetch("/api/user/business-type", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessType,
          businessSubtype,
        }),
      });

      if (response.ok) {
        const payload = await response.json();
        updateCache({
          businessType: payload.businessType,
          businessSubtype: payload.businessSubtype,
        });
        toast({
          title: "Settings saved",
          description: "Your business type preferences have been updated.",
        });
      } else {
        throw new Error("Failed to save");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save business type settings.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
      refetch();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <IconComponent className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Business Type & Industry</CardTitle>
              <CardDescription>
                Configure your business type to get personalized content, templates, and analytics
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Selection Preview */}
          <div className="p-4 bg-muted/30 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Current Business Type</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-sm">
                    {selectedBusinessConfig?.label}
                  </Badge>
                  <span className="text-muted-foreground">→</span>
                  <Badge variant="outline" className="text-sm">
                    {selectedBusinessConfig?.subtypes.find(st => st.id === businessSubtype)?.label}
                  </Badge>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {isFetching || isRefetching ? "Refreshing..." : "Synced"}
              </div>
            </div>
          </div>

          {/* Business Type Selector */}
          <div className="space-y-2">
            <Label htmlFor="business-type" className="text-base font-semibold">
              Primary Industry
            </Label>
            <Select value={businessType} onValueChange={(value) => {
              setBusinessType(value);
              // Clear subtype when industry changes - user can select a new one if needed
              setBusinessSubtype("");
            }}>
              <SelectTrigger id="business-type" className="h-12">
                <SelectValue placeholder="Select your industry" />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{type.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Choose the industry that best describes your business
            </p>
          </div>

          {/* Business Subtype Selector */}
          <div className="space-y-2">
            <Label htmlFor="business-subtype" className="text-base font-semibold">
              Business Specialty
            </Label>
            <Select value={businessSubtype} onValueChange={setBusinessSubtype}>
              <SelectTrigger id="business-subtype" className="h-12">
                <SelectValue placeholder="Select your specialty" />
              </SelectTrigger>
              <SelectContent>
                {selectedBusinessConfig?.subtypes.map((subtype) => (
                  <SelectItem key={subtype.id} value={subtype.id}>
                    {subtype.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Specify your business specialty for more targeted content
            </p>
          </div>

          {/* What This Affects */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
            <h4 className="font-semibold text-sm mb-2 text-blue-900 dark:text-blue-100">
              What this affects:
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• AI content generation prompts and suggestions</li>
              <li>• Pre-built templates and post ideas</li>
              <li>• Dashboard analytics labels and metrics</li>
              <li>• Onboarding guidance and recommendations</li>
              <li>• Industry-specific features and tools</li>
            </ul>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              className="min-w-32"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Future Features Preview */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Coming Soon</CardTitle>
          <CardDescription>
            Features being built based on your business type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-1">Industry Templates</p>
              <p className="text-xs text-muted-foreground">
                Pre-built content templates for your industry
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-1">Smart Analytics</p>
              <p className="text-xs text-muted-foreground">
                Industry-specific metrics and benchmarks
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-1">Competitor Insights</p>
              <p className="text-xs text-muted-foreground">
                Track competitors in your specialty
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-1">Custom Workflows</p>
              <p className="text-xs text-muted-foreground">
                Automation built for your business type
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
