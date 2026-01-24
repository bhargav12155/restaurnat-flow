import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface BusinessTypeResponse {
  businessType: string;
  businessSubtype: string;
}

// Business type options with labels and icons
export const BUSINESS_TYPES = [
  { value: "restaurant", label: "Restaurant", icon: "Utensils" },
  { value: "home_services", label: "Home Services", icon: "Home" },
  { value: "real_estate", label: "Real Estate", icon: "Building" },
  { value: "retail", label: "Retail", icon: "Store" },
  { value: "professional_services", label: "Professional Services", icon: "Briefcase" },
  { value: "general", label: "General Business", icon: "Building2" },
] as const;

// Get display label for a business type
export function getBusinessLabels(businessType?: string): string {
  const type = BUSINESS_TYPES.find(t => t.value === businessType);
  return type?.label || "Restaurant";
}

export function useBusinessType() {
  const queryClient = useQueryClient();

  const query = useQuery<BusinessTypeResponse>({
    queryKey: ["/api/user/business-type"],
    queryFn: async () => {
      console.log("[useBusinessType] Fetching business type from API...");
      const response = await apiRequest("GET", "/api/user/business-type");
      if (!response.ok) {
        throw new Error("Failed to fetch business type");
      }
      const data = await response.json();
      console.log("[useBusinessType] Fetched from API:", data);
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: async (newType: string) => {
      console.log("[useBusinessType] Updating business type to:", newType);
      const response = await apiRequest("POST", "/api/user/business-type", {
        businessType: newType,
        businessSubtype: "", // Clear subtype when changing main type
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[useBusinessType] Update failed:", errorText);
        throw new Error("Failed to update business type");
      }
      const data = await response.json();
      console.log("[useBusinessType] Update response:", data);
      return data;
    },
    onSuccess: (data) => {
      console.log("[useBusinessType] onSuccess - setting cache to:", data);
      queryClient.setQueryData(["/api/user/business-type"], {
        businessType: data.businessType,
        businessSubtype: data.businessSubtype,
      });
      // Invalidate queries that depend on business type
      queryClient.invalidateQueries({ queryKey: ["/api/user/business-type"] });
    },
    onError: (error) => {
      console.error("[useBusinessType] Mutation error:", error);
    },
  });

  const updateCache = (data: BusinessTypeResponse) => {
    queryClient.setQueryData(["/api/user/business-type"], data);
  };

  // Validate subtype matches business type
  const VALID_SUBTYPES: Record<string, string[]> = {
    restaurant: ['fast_casual', 'fine_dining', 'cafe', 'bar_pub', 'food_truck', 'catering', 'bakery', 'quick_service'],
    home_services: ['plumbing', 'hvac', 'electrical', 'cleaning', 'landscaping', 'roofing', 'painting', 'handyman'],
    real_estate: ['residential', 'commercial', 'luxury', 'property_management', 'rental', 'investment'],
    retail: ['clothing', 'electronics', 'grocery', 'specialty', 'fashion', 'beauty', 'sports', 'home_goods'],
    professional_services: ['legal', 'accounting', 'consulting', 'marketing', 'insurance', 'financial'],
  };

  // Get display labels
  const businessType = query.data?.businessType || "restaurant";
  const rawSubtype = query.data?.businessSubtype || "";
  
  // Only use subtype if it's valid for the current business type
  const isValidSubtype = VALID_SUBTYPES[businessType]?.includes(rawSubtype);
  const businessSubtype = isValidSubtype ? rawSubtype : "";
  
  const businessTypeLabel = getBusinessLabels(businessType);
  const businessSubtypeLabel = businessSubtype ? 
    businessSubtype.charAt(0).toUpperCase() + businessSubtype.slice(1).replace(/_/g, " ") : 
    "";

  // Debug log current state
  console.log("[useBusinessType] Current state:", {
    rawData: query.data,
    businessType,
    businessSubtype,
    businessTypeLabel,
    businessSubtypeLabel,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
  });

  return { 
    ...query, 
    updateCache,
    updateBusinessType: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    businessType,
    businessSubtype,
    businessTypeLabel,
    businessSubtypeLabel,
  };
}
