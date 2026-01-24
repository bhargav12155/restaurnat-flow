/**
 * Business-type aware terminology mapping
 * Returns appropriate labels based on the user's business type
 */

export interface BusinessTerminology {
  // Product/Service terminology
  item: string;
  items: string;
  itemCapitalized: string;
  itemsCapitalized: string;
  
  // Catalog terminology
  catalog: string;
  catalogCapitalized: string;
  
  // Category terminology
  category: string;
  categories: string;
  
  // Action verbs
  addItem: string;
  editItem: string;
  deleteItem: string;
  searchItem: string;
  selectItem: string;
  
  // Professional role
  professionalRole: string;
  
  // Business identifier
  businessHandle: string;
}

export const getBusinessTerminology = (
  businessType?: string,
  businessSubtype?: string
): BusinessTerminology => {
  const type = businessType || "restaurant";
  
  // Restaurant & Food Service
  if (type === "restaurant") {
    return {
      item: "menu item",
      items: "menu items",
      itemCapitalized: "Menu Item",
      itemsCapitalized: "Menu Items",
      catalog: "menu",
      catalogCapitalized: "Menu",
      category: "category",
      categories: "categories",
      addItem: "Add New Menu Item",
      editItem: "Edit Menu Item",
      deleteItem: "Delete menu item",
      searchItem: "Search menu items",
      selectItem: "Select a menu item",
      professionalRole: "Restaurant Professional",
      businessHandle: `our_${(businessSubtype || "restaurant").replace(/[^a-z0-9]/gi, "")}`,
    };
  }
  
  // Home Services (Plumbing, HVAC, Electrical, etc.)
  if (type === "home_services") {
    return {
      item: "service",
      items: "services",
      itemCapitalized: "Service",
      itemsCapitalized: "Services",
      catalog: "service catalog",
      catalogCapitalized: "Service Catalog",
      category: "service type",
      categories: "service types",
      addItem: "Add New Service",
      editItem: "Edit Service",
      deleteItem: "Delete service",
      searchItem: "Search services",
      selectItem: "Select a service",
      professionalRole: `${businessSubtype === "plumbing" ? "Plumber" : businessSubtype === "hvac" ? "HVAC Technician" : businessSubtype === "electrical" ? "Electrician" : "Service Professional"}`,
      businessHandle: `${(businessSubtype || "services").replace(/[^a-z0-9]/gi, "")}_pro`,
    };
  }
  
  // Real Estate
  if (type === "real_estate") {
    return {
      item: "property",
      items: "properties",
      itemCapitalized: "Property",
      itemsCapitalized: "Properties",
      catalog: "listings",
      catalogCapitalized: "Listings",
      category: "property type",
      categories: "property types",
      addItem: "Add New Listing",
      editItem: "Edit Property",
      deleteItem: "Delete listing",
      searchItem: "Search properties",
      selectItem: "Select a property",
      professionalRole: "Real Estate Professional",
      businessHandle: "realtor_homes",
    };
  }
  
  // Retail & E-commerce
  if (type === "retail") {
    return {
      item: "product",
      items: "products",
      itemCapitalized: "Product",
      itemsCapitalized: "Products",
      catalog: "catalog",
      catalogCapitalized: "Catalog",
      category: "category",
      categories: "categories",
      addItem: "Add New Product",
      editItem: "Edit Product",
      deleteItem: "Delete product",
      searchItem: "Search products",
      selectItem: "Select a product",
      professionalRole: "Retail Professional",
      businessHandle: `${(businessSubtype || "shop").replace(/[^a-z0-9]/gi, "")}_store`,
    };
  }
  
  // Professional Services
  if (type === "professional_services") {
    return {
      item: "service",
      items: "services",
      itemCapitalized: "Service",
      itemsCapitalized: "Services",
      catalog: "service offerings",
      catalogCapitalized: "Service Offerings",
      category: "service category",
      categories: "service categories",
      addItem: "Add New Service",
      editItem: "Edit Service",
      deleteItem: "Delete service",
      searchItem: "Search services",
      selectItem: "Select a service",
      professionalRole: `${businessSubtype === "legal" ? "Attorney" : businessSubtype === "accounting" ? "Accountant" : businessSubtype === "consulting" ? "Consultant" : "Professional"}`,
      businessHandle: `${(businessSubtype || "services").replace(/[^a-z0-9]/gi, "")}_pro`,
    };
  }
  
  // General/Fallback
  return {
    item: "item",
    items: "items",
    itemCapitalized: "Item",
    itemsCapitalized: "Items",
    catalog: "catalog",
    catalogCapitalized: "Catalog",
    category: "category",
    categories: "categories",
    addItem: "Add New Item",
    editItem: "Edit Item",
    deleteItem: "Delete item",
    searchItem: "Search items",
    selectItem: "Select an item",
    professionalRole: "Business Professional",
    businessHandle: "our_business",
  };
};
