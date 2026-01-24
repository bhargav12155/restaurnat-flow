import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Utensils, 
  DollarSign, 
  Clock, 
  Flame, 
  Leaf, 
  Star, 
  ChefHat,
  Plus,
  Edit,
  Trash2,
  Loader2,
  ImageIcon,
  X,
  CheckCircle,
  Filter
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useBusinessType } from "@/hooks/useBusinessType";
import { getBusinessTerminology } from "@/lib/businessTerminology";

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface FoodCategory {
  id: string;
  userId: string;
  name: string;
  description?: string;
  displayOrder?: number;
  icon?: string;
  imageUrl?: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface MenuItem {
  id: string;
  userId: string;
  categoryId?: string;
  name: string;
  description?: string;
  price: string;
  specialPrice?: string;
  isSpecial?: boolean;
  specialEndDate?: string;
  ingredients?: string[];
  dietaryTags?: string[];
  allergens?: string[];
  spiceLevel?: number;
  calories?: number;
  preparationTime?: number;
  servingSize?: string;
  imageUrls?: string[];
  videoUrl?: string;
  availability?: string;
  popularityScore?: number;
  isFeatured?: boolean;
  isChefRecommended?: boolean;
  tags?: string[];
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
  // Joined fields
  categoryName?: string;
}

// Dietary tag options
const DIETARY_TAGS = [
  { value: "vegetarian", label: "Vegetarian", icon: "🥬" },
  { value: "vegan", label: "Vegan", icon: "🌱" },
  { value: "gluten-free", label: "Gluten-Free", icon: "🌾" },
  { value: "halal", label: "Halal", icon: "☪️" },
  { value: "kosher", label: "Kosher", icon: "✡️" },
  { value: "dairy-free", label: "Dairy-Free", icon: "🥛" },
  { value: "nut-free", label: "Nut-Free", icon: "🥜" },
  { value: "low-carb", label: "Low-Carb", icon: "🥩" },
  { value: "keto", label: "Keto", icon: "🥑" },
];

// Common allergens
const ALLERGENS = [
  "dairy", "eggs", "fish", "shellfish", "tree-nuts", 
  "peanuts", "wheat", "soy", "sesame"
];

// Availability options
const AVAILABILITY_OPTIONS = [
  { value: "available", label: "Available", color: "bg-green-500" },
  { value: "sold_out", label: "Sold Out", color: "bg-red-500" },
  { value: "seasonal", label: "Seasonal", color: "bg-orange-500" },
  { value: "limited", label: "Limited Time", color: "bg-yellow-500" },
];

// Default category icons
const CATEGORY_ICONS = ["🍕", "🍝", "🥗", "🍰", "🍔", "🌮", "🍣", "🥘", "🍜", "🥩", "🍳", "🥪"];

interface MenuItemSelectorProps {
  onSelectMenuItem: (menuItem: MenuItem) => void;
  selectedMenuItem?: MenuItem | null;
  showQuickAdd?: boolean;  // Show a prominent "Quick Add" button
  onQuickAddClick?: () => void;  // Callback when quick add is clicked
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function MenuItemSelector({ 
  onSelectMenuItem, 
  selectedMenuItem,
  showQuickAdd = false,
  onQuickAddClick
}: MenuItemSelectorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: businessData } = useBusinessType();
  const businessType = businessData?.businessType || 'general';
  const businessSubtype = businessData?.businessSubtype || '';
  const terms = getBusinessTerminology(businessType, businessSubtype);
  
  // State
  const [showDialog, setShowDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterDietaryTags, setFilterDietaryTags] = useState<string[]>([]);
  const [showCreateItem, setShowCreateItem] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  
  // Form state for new/edit menu item
  const [itemForm, setItemForm] = useState({
    name: "",
    description: "",
    price: "",
    specialPrice: "",
    isSpecial: false,
    categoryId: "",
    ingredients: "",
    dietaryTags: [] as string[],
    allergens: [] as string[],
    spiceLevel: 0,
    calories: "",
    preparationTime: "",
    servingSize: "",
    availability: "available",
    isFeatured: false,
    isChefRecommended: false,
    tags: "",
  });

  // Form state for new category
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    icon: "🍽️",
    displayOrder: 0,
  });

  // =====================================================
  // QUERIES
  // =====================================================

  // Fetch categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<FoodCategory[]>({
    queryKey: ["food-categories"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/menu/categories");
      return response.json();
    },
  });

  // Fetch menu items
  const { data: menuItems = [], isLoading: itemsLoading, refetch: refetchItems } = useQuery<MenuItem[]>({
    queryKey: ["menu-items", filterCategory, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterCategory && filterCategory !== "all") {
        params.append("categoryId", filterCategory);
      }
      if (searchQuery) {
        params.append("search", searchQuery);
      }
      const response = await apiRequest("GET", `/api/menu/items?${params.toString()}`);
      return response.json();
    },
  });

  // =====================================================
  // MUTATIONS
  // =====================================================

  // Create category
  const createCategoryMutation = useMutation({
    mutationFn: async (data: typeof categoryForm) => {
      const response = await apiRequest("POST", "/api/menu/categories", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Category Created", description: "New food category added successfully" });
      queryClient.invalidateQueries({ queryKey: ["food-categories"] });
      setShowCreateCategory(false);
      setCategoryForm({ name: "", description: "", icon: "🍽️", displayOrder: 0 });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create category", variant: "destructive" });
    },
  });

  // Create menu item
  const createItemMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/menu/items", data);
      return response.json();
    },
    onSuccess: (newItem) => {
      toast({ title: "Item Created", description: `New ${terms.item} added successfully` });
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      refetchItems(); // Force refetch
      setShowCreateItem(false);
      setShowDialog(false); // Close the main dialog
      resetItemForm();
      // Auto-select the newly created item
      if (newItem && newItem.id) {
        onSelectMenuItem(newItem);
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create item", variant: "destructive" });
    },
  });

  // Update menu item
  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PUT", `/api/menu/items/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Item Updated", description: `${terms.itemCapitalized} updated successfully` });
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      setEditingItem(null);
      resetItemForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update item", variant: "destructive" });
    },
  });

  // Delete menu item
  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/menu/items/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Item Deleted", description: `${terms.itemCapitalized} removed successfully` });
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete item", variant: "destructive" });
    },
  });

  // =====================================================
  // HELPERS
  // =====================================================

  const resetItemForm = () => {
    setItemForm({
      name: "",
      description: "",
      price: "",
      specialPrice: "",
      isSpecial: false,
      categoryId: "",
      ingredients: "",
      dietaryTags: [],
      allergens: [],
      spiceLevel: 0,
      calories: "",
      preparationTime: "",
      servingSize: "",
      availability: "available",
      isFeatured: false,
      isChefRecommended: false,
      tags: "",
    });
  };

  const loadItemForEdit = (item: MenuItem) => {
    setItemForm({
      name: item.name,
      description: item.description || "",
      price: item.price,
      specialPrice: item.specialPrice || "",
      isSpecial: item.isSpecial || false,
      categoryId: item.categoryId || "",
      ingredients: item.ingredients?.join(", ") || "",
      dietaryTags: item.dietaryTags || [],
      allergens: item.allergens || [],
      spiceLevel: item.spiceLevel || 0,
      calories: item.calories?.toString() || "",
      preparationTime: item.preparationTime?.toString() || "",
      servingSize: item.servingSize || "",
      availability: item.availability || "available",
      isFeatured: item.isFeatured || false,
      isChefRecommended: item.isChefRecommended || false,
      tags: item.tags?.join(", ") || "",
    });
    setEditingItem(item);
    setShowCreateItem(true);
  };

  const handleSaveItem = () => {
    const data = {
      ...itemForm,
      price: itemForm.price,
      specialPrice: itemForm.specialPrice || null,
      ingredients: itemForm.ingredients.split(",").map(s => s.trim()).filter(Boolean),
      calories: itemForm.calories ? parseInt(itemForm.calories) : null,
      preparationTime: itemForm.preparationTime ? parseInt(itemForm.preparationTime) : null,
      tags: itemForm.tags.split(",").map(s => s.trim()).filter(Boolean),
      categoryId: itemForm.categoryId && itemForm.categoryId !== "none" ? itemForm.categoryId : null,
    };

    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data });
    } else {
      createItemMutation.mutate(data);
    }
  };

  const formatPrice = (price: string | number) => {
    const num = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  // Filter items based on dietary tags
  const filteredItems = menuItems.filter(item => {
    if (filterDietaryTags.length === 0) return true;
    return filterDietaryTags.every(tag => item.dietaryTags?.includes(tag));
  });

  // =====================================================
  // RENDER HELPERS
  // =====================================================

  const SpiceLevelIndicator = ({ level }: { level: number }) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Flame
          key={i}
          className={`h-3 w-3 ${i <= level ? 'text-red-500' : 'text-gray-300'}`}
          fill={i <= level ? 'currentColor' : 'none'}
        />
      ))}
    </div>
  );

  const DietaryBadges = ({ tags }: { tags?: string[] }) => {
    if (!tags?.length) return null;
    return (
      <div className="flex flex-wrap gap-1">
        {tags.map(tag => {
          const tagInfo = DIETARY_TAGS.find(t => t.value === tag);
          return (
            <Badge key={tag} variant="outline" className="text-xs">
              {tagInfo?.icon} {tagInfo?.label || tag}
            </Badge>
          );
        })}
      </div>
    );
  };

  const AvailabilityBadge = ({ availability }: { availability?: string }) => {
    const option = AVAILABILITY_OPTIONS.find(o => o.value === availability) || AVAILABILITY_OPTIONS[0];
    return (
      <Badge className={`${option.color} text-white text-xs`}>
        {option.label}
      </Badge>
    );
  };

  // =====================================================
  // MENU ITEM CARD
  // =====================================================

  const MenuItemCard = ({ item }: { item: MenuItem }) => (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow" 
      onClick={() => {
        onSelectMenuItem(item);
        setShowDialog(false);
        toast({ title: "Item Selected", description: item.name });
      }}
    >
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Item Image */}
          <div className="w-24 h-24 bg-muted rounded-lg flex-shrink-0 overflow-hidden">
            {item.imageUrls?.[0] ? (
              <img 
                src={item.imageUrls[0]} 
                alt={item.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Utensils className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Item Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                  {item.isFeatured && (
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  )}
                  {item.isChefRecommended && (
                    <ChefHat className="h-4 w-4 text-purple-500" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {item.description}
                </p>
              </div>
              <div className="text-right">
                {item.isSpecial && item.specialPrice ? (
                  <div>
                    <p className="text-xs line-through text-muted-foreground">
                      {formatPrice(item.price)}
                    </p>
                    <p className="font-bold text-primary">
                      {formatPrice(item.specialPrice)}
                    </p>
                  </div>
                ) : (
                  <p className="font-bold text-primary">{formatPrice(item.price)}</p>
                )}
                <AvailabilityBadge availability={item.availability} />
              </div>
            </div>

            {/* Meta info */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
              {businessType === 'restaurant' && item.preparationTime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {item.preparationTime} min
                </span>
              )}
              {businessType === 'restaurant' && item.calories && (
                <span>{item.calories} cal</span>
              )}
              {businessType === 'restaurant' && item.spiceLevel && item.spiceLevel > 0 && (
                <SpiceLevelIndicator level={item.spiceLevel} />
              )}
            </div>

            {/* Dietary tags - Restaurant only */}
            {businessType === 'restaurant' && (
              <div className="mt-2">
                <DietaryBadges tags={item.dietaryTags} />
              </div>
            )}
          </div>

          {/* Action buttons (shown on hover) */}
          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                loadItemForEdit(item);
              }}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-500 hover:text-red-600"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("Delete this menu item?")) {
                  deleteItemMutation.mutate(item.id);
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // =====================================================
  // CREATE/EDIT ITEM FORM (inline JSX to prevent focus loss)
  // =====================================================

  const itemFormContent = (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="item-name">Name *</Label>
          <Input
            id="item-name"
            value={itemForm.name}
            onChange={(e) => setItemForm(f => ({ ...f, name: e.target.value }))}
            placeholder={businessType === 'restaurant' ? 'e.g., Margherita Pizza' : businessType === 'home_services' ? `e.g., ${businessSubtype === 'plumbing' ? 'Emergency Drain Cleaning' : businessSubtype === 'hvac' ? 'AC System Installation' : businessSubtype === 'electrical' ? 'Outlet Installation' : 'Standard Service'}` : businessType === 'real_estate' ? 'e.g., 3BR Luxury Condo' : 'e.g., Premium Product'}
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="item-description">Description</Label>
          <Textarea
            id="item-description"
            value={itemForm.description}
            onChange={(e) => setItemForm(f => ({ ...f, description: e.target.value }))}
            placeholder={businessType === 'restaurant' ? 'Fresh mozzarella, tomato sauce, basil...' : businessType === 'home_services' ? 'Professional service with certified technicians...' : businessType === 'real_estate' ? 'Modern finishes, updated kitchen, prime location...' : 'High-quality product with premium features...'}
            rows={2}
          />
        </div>
        <div>
          <Label htmlFor="item-price">Price *</Label>
          <div className="relative">
            <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="item-price"
              type="number"
              step="0.01"
              className="pl-8"
              value={itemForm.price}
              onChange={(e) => setItemForm(f => ({ ...f, price: e.target.value }))}
              placeholder="12.99"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="item-category">Category</Label>
          <Select
            value={itemForm.categoryId}
            onValueChange={(v) => setItemForm(f => ({ ...f, categoryId: v }))}
            disabled={categories.length === 0}
          >
            <SelectTrigger id="item-category">
              <SelectValue placeholder={categories.length === 0 ? "No categories available" : "Select category"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {categories.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              <button
                type="button"
                onClick={() => {
                  setShowCreateItem(false);
                  setTimeout(() => setShowCreateCategory(true), 100);
                }}
                className="text-primary hover:underline"
              >
                Create a category first
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Special Price */}
      <div className="space-y-2 p-3 border rounded-lg">
        <div className="flex items-center gap-2">
          <Checkbox
            id="is-special"
            checked={itemForm.isSpecial}
            onCheckedChange={(checked) => 
              setItemForm(f => ({ ...f, isSpecial: checked as boolean }))
            }
          />
          <Label htmlFor="is-special" className="text-sm font-medium">
            This is a special/promotional item
          </Label>
        </div>
        {itemForm.isSpecial && (
          <div>
            <Label htmlFor="special-price">Special Price</Label>
            <div className="relative">
              <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="special-price"
                type="number"
                step="0.01"
                className="pl-8"
                value={itemForm.specialPrice}
                onChange={(e) => setItemForm(f => ({ ...f, specialPrice: e.target.value }))}
                placeholder="9.99"
              />
            </div>
          </div>
        )}
      </div>

      {/* Item Details - Restaurant specific */}
      {businessType === 'restaurant' && (
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="prep-time">Prep Time (min)</Label>
            <Input
              id="prep-time"
              type="number"
              value={itemForm.preparationTime}
              onChange={(e) => setItemForm(f => ({ ...f, preparationTime: e.target.value }))}
              placeholder="15"
            />
          </div>
          <div>
            <Label htmlFor="calories">Calories</Label>
            <Input
              id="calories"
              type="number"
              value={itemForm.calories}
              onChange={(e) => setItemForm(f => ({ ...f, calories: e.target.value }))}
              placeholder="450"
            />
          </div>
          <div>
            <Label htmlFor="serving-size">Serving Size</Label>
            <Input
              id="serving-size"
              value={itemForm.servingSize}
              onChange={(e) => setItemForm(f => ({ ...f, servingSize: e.target.value }))}
              placeholder="1 person"
            />
          </div>
        </div>
      )}

      {/* Spice Level - Restaurant only */}
      {businessType === 'restaurant' && (
        <div>
          <Label>Spice Level</Label>
          <div className="flex items-center gap-2 mt-1">
            {[0, 1, 2, 3, 4, 5].map((level) => (
              <Button
                key={level}
                type="button"
                variant={itemForm.spiceLevel === level ? "default" : "outline"}
                size="sm"
                onClick={() => setItemForm(f => ({ ...f, spiceLevel: level }))}
              >
                {level === 0 ? "None" : (
                  <div className="flex">
                    {Array(level).fill(0).map((_, i) => (
                      <Flame key={i} className="h-3 w-3 text-red-500" fill="currentColor" />
                    ))}
                  </div>
                )}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Dietary Tags - Restaurant only */}
      {businessType === 'restaurant' && (
        <div>
          <Label>Dietary Tags</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {DIETARY_TAGS.map(tag => (
              <Button
                key={tag.value}
                type="button"
                variant={itemForm.dietaryTags.includes(tag.value) ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setItemForm(f => ({
                    ...f,
                    dietaryTags: f.dietaryTags.includes(tag.value)
                      ? f.dietaryTags.filter(t => t !== tag.value)
                      : [...f.dietaryTags, tag.value]
                  }));
                }}
              >
                {tag.icon} {tag.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Allergens - Restaurant only */}
      {businessType === 'restaurant' && (
        <div>
          <Label>Allergens</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {ALLERGENS.map(allergen => (
              <Button
                key={allergen}
                type="button"
                variant={itemForm.allergens.includes(allergen) ? "destructive" : "outline"}
                size="sm"
                onClick={() => {
                  setItemForm(f => ({
                    ...f,
                    allergens: f.allergens.includes(allergen)
                      ? f.allergens.filter(a => a !== allergen)
                      : [...f.allergens, allergen]
                  }));
                }}
              >
                {allergen}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Ingredients */}
      <div>
        <Label htmlFor="ingredients">{businessType === 'restaurant' ? 'Ingredients' : 'Components'} (comma-separated)</Label>
        <Textarea
          id="ingredients"
          value={itemForm.ingredients}
          onChange={(e) => setItemForm(f => ({ ...f, ingredients: e.target.value }))}
          placeholder={businessType === 'restaurant' ? 'Mozzarella, tomato sauce, fresh basil, olive oil...' : businessType === 'home_services' ? 'Tools, materials, equipment required...' : businessType === 'real_estate' ? 'Appliances, fixtures, features included...' : 'Key components and materials...'}
          rows={2}
        />
      </div>

      {/* Availability */}
      <div>
        <Label htmlFor="availability">Availability</Label>
        <Select
          value={itemForm.availability}
          onValueChange={(v) => setItemForm(f => ({ ...f, availability: v }))}
        >
          <SelectTrigger id="availability">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AVAILABILITY_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Featured/Chef Recommended */}
      <div className="flex gap-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id="is-featured"
            checked={itemForm.isFeatured}
            onCheckedChange={(checked) => 
              setItemForm(f => ({ ...f, isFeatured: checked as boolean }))
            }
          />
          <Label htmlFor="is-featured" className="flex items-center gap-1">
            <Star className="h-4 w-4 text-yellow-500" /> Featured
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="is-chef-recommended"
            checked={itemForm.isChefRecommended}
            onCheckedChange={(checked) => 
              setItemForm(f => ({ ...f, isChefRecommended: checked as boolean }))
            }
          />
          <Label htmlFor="is-chef-recommended" className="flex items-center gap-1">
            <ChefHat className="h-4 w-4 text-purple-500" /> {businessType === 'restaurant' ? "Chef's Pick" : businessType === 'home_services' ? 'Expert Pick' : businessType === 'real_estate' ? 'Featured' : 'Recommended'}
          </Label>
        </div>
      </div>

      {/* Tags */}
      <div>
        <Label htmlFor="tags">Tags (comma-separated)</Label>
        <Input
          id="tags"
          value={itemForm.tags}
          onChange={(e) => setItemForm(f => ({ ...f, tags: e.target.value }))}
          placeholder={businessType === 'restaurant' ? 'bestseller, house-special, new...' : businessType === 'home_services' ? 'popular, emergency, certified...' : businessType === 'real_estate' ? 'featured, new-listing, reduced...' : 'featured, bestseller, new...'}
        />
      </div>
    </div>
  );

  // =====================================================
  // MAIN RENDER
  // =====================================================

  return (
    <>
      {/* Quick Add Button (shown when enabled) */}
      {showQuickAdd && (
        <div className="mb-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full border-dashed border-primary/50 text-primary hover:bg-primary/5"
            onClick={() => {
              if (onQuickAddClick) {
                onQuickAddClick();
              }
              // Only open Create Item dialog, not the browse dialog
              resetItemForm();
              setEditingItem(null);
              setShowCreateItem(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Quick Add Custom {terms.itemCapitalized}
          </Button>
        </div>
      )}
      
      {/* Selected Item Display */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) {
          setShowCreateItem(false);
        }
      }}>
        <DialogTrigger asChild>
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              {selectedMenuItem ? (
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                    {selectedMenuItem.imageUrls?.[0] ? (
                      <img 
                        src={selectedMenuItem.imageUrls[0]} 
                        alt={selectedMenuItem.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Utensils className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{selectedMenuItem.name}</h3>
                      {selectedMenuItem.isFeatured && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {selectedMenuItem.description}
                    </p>
                    <p className="font-bold text-primary">
                      {formatPrice(selectedMenuItem.price)}
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Change
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                  <Utensils className="h-5 w-5" />
                  <span>{terms.selectItem}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </DialogTrigger>

        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Utensils className="h-5 w-5" />
              {terms.itemsCapitalized} Selector
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="browse">Browse Menu</TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
            </TabsList>

            {/* Browse Tab */}
            <TabsContent value="browse" className="space-y-4">
              {/* Search & Filters */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder={terms.searchItem}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger id="filter-category" className="w-40">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => setShowCreateItem(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>

              {/* Dietary Filter Chips - Restaurant only */}
              {businessType === 'restaurant' && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Filter className="h-3 w-3" /> Dietary:
                  </span>
                  {DIETARY_TAGS.slice(0, 5).map(tag => (
                    <Badge
                      key={tag.value}
                      variant={filterDietaryTags.includes(tag.value) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        setFilterDietaryTags(prev =>
                          prev.includes(tag.value)
                            ? prev.filter(t => t !== tag.value)
                            : [...prev, tag.value]
                        );
                      }}
                    >
                      {tag.icon} {tag.label}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Menu Items List */}
              <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                {itemsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Utensils className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No {terms.items} found</p>
                    <Button
                      variant="link"
                      onClick={() => setShowCreateItem(true)}
                    >
                      Add your first {terms.item}
                    </Button>
                  </div>
                ) : (
                  filteredItems.map(item => (
                    <div key={item.id} className="group">
                      <MenuItemCard item={item} />
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Categories Tab */}
            <TabsContent value="categories" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">{businessType === 'restaurant' ? 'Food Categories' : businessType === 'home_services' ? 'Service Categories' : businessType === 'real_estate' ? 'Property Categories' : 'Categories'}</h3>
                <Button size="sm" onClick={() => setShowCreateCategory(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Category
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {categoriesLoading ? (
                  <div className="col-span-full flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : categories.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    <p>No categories yet</p>
                    <Button
                      variant="link"
                      onClick={() => setShowCreateCategory(true)}
                    >
                      Create your first category
                    </Button>
                  </div>
                ) : (
                  categories.map(cat => (
                    <Card key={cat.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="text-2xl">{cat.icon}</div>
                        <div>
                          <h4 className="font-medium">{cat.name}</h4>
                          {cat.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {cat.description}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Item Dialog */}
      <Dialog open={showCreateItem} onOpenChange={(open) => {
        setShowCreateItem(open);
        if (!open) {
          setEditingItem(null);
          resetItemForm();
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? terms.editItem : terms.addItem}
            </DialogTitle>
          </DialogHeader>
          {itemFormContent}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateItem(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveItem}
              disabled={!itemForm.name || !itemForm.price || createItemMutation.isPending || updateItemMutation.isPending}
            >
              {(createItemMutation.isPending || updateItemMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingItem ? `Update ${terms.itemCapitalized}` : `Create ${terms.itemCapitalized}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Category Dialog */}
      <Dialog open={showCreateCategory} onOpenChange={setShowCreateCategory}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="cat-name">Name *</Label>
              <Input
                id="cat-name"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm(f => ({ ...f, name: e.target.value }))}
                placeholder={businessType === 'restaurant' ? 'e.g., Pizza, Pasta, Desserts' : businessType === 'home_services' ? 'e.g., Plumbing, HVAC, Electrical' : businessType === 'real_estate' ? 'e.g., Residential, Commercial, Land' : 'e.g., Category A, Category B'}
              />
            </div>
            <div>
              <Label htmlFor="cat-desc">Description</Label>
              <Input
                id="cat-desc"
                value={categoryForm.description}
                onChange={(e) => setCategoryForm(f => ({ ...f, description: e.target.value }))}
                placeholder={businessType === 'restaurant' ? 'Traditional Italian pizzas...' : businessType === 'home_services' ? 'Professional services for your needs...' : businessType === 'real_estate' ? 'Properties in this category...' : 'Items in this category...'}
              />
            </div>
            <div>
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {CATEGORY_ICONS.map(icon => (
                  <Button
                    key={icon}
                    type="button"
                    variant={categoryForm.icon === icon ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCategoryForm(f => ({ ...f, icon }))}
                  >
                    {icon}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateCategory(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => createCategoryMutation.mutate(categoryForm)}
              disabled={!categoryForm.name || createCategoryMutation.isPending}
            >
              {createCategoryMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
