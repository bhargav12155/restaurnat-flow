export const BUSINESS_TYPE_LABELS: Record<string, string> = {
  restaurant: "Restaurant & Food Service",
  home_services: "Home Services",
  real_estate: "Real Estate",
  retail: "Retail & E-commerce",
  professional_services: "Professional Services",
  general: "General Business",
};

export const BUSINESS_SUBTYPE_LABELS: Record<string, string> = {
  fine_dining: "Fine Dining",
  fast_casual: "Fast Casual",
  cafe: "Café & Coffee Shop",
  bar_pub: "Bar & Pub",
  food_truck: "Food Truck",
  catering: "Catering Service",
  bakery: "Bakery",
  quick_service: "Quick Service",
  plumbing: "Plumbing",
  hvac: "HVAC",
  electrical: "Electrical",
  cleaning: "Cleaning Service",
  landscaping: "Landscaping",
  roofing: "Roofing",
  painting: "Painting",
  handyman: "Handyman",
  residential: "Residential Sales",
  commercial: "Commercial Real Estate",
  property_management: "Property Management",
  rental: "Rental Services",
  investment: "Investment Properties",
  fashion: "Fashion & Apparel",
  electronics: "Electronics",
  beauty: "Beauty & Cosmetics",
  sports: "Sports & Fitness",
  home_goods: "Home Goods",
  specialty: "Specialty Store",
  legal: "Legal Services",
  accounting: "Accounting & Tax",
  consulting: "Consulting",
  marketing: "Marketing Agency",
  insurance: "Insurance",
  financial: "Financial Services",
  other: "Other",
};

export const getBusinessLabels = (businessType?: string, businessSubtype?: string) => {
  const typeLabel = BUSINESS_TYPE_LABELS[businessType || ""] || "Restaurant & Food Service";
  const subtypeLabel = BUSINESS_SUBTYPE_LABELS[businessSubtype || ""] || "Fast Casual";
  return { typeLabel, subtypeLabel };
};
