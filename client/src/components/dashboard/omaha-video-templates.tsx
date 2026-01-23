import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  MapPin, 
  Utensils, 
  TrendingUp, 
  Users, 
  ChefHat,
  Sparkles,
  Clock,
  Star,
  Play,
  Copy,
  Wand2
} from "lucide-react";

interface VideoTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: any;
  duration: number;
  cuisine?: string;
  script: string;
  hooks: string[];
  callToAction: string;
  tags: string[];
}

const restaurantVideoTemplates: VideoTemplate[] = [
  // Dish Spotlights
  {
    id: "signature-dish",
    title: "Signature Dish Showcase",
    description: "Highlight your most popular and signature dishes",
    category: "dishes",
    icon: Utensils,
    duration: 90,
    cuisine: "Any",
    script: `Hi, I'm the chef at [Restaurant Name]. Today I want to introduce you to our signature dish that customers can't stop talking about.

This is our [Dish Name] - a perfect combination of [key ingredients] that we've perfected over years of careful preparation.

What makes this dish special? First, we source only the finest ingredients. Our [main ingredient] is [sourcing detail]. Second, the preparation - we [preparation method] to ensure every bite is absolutely perfect.

The flavors here are incredible - you'll taste the [flavor notes] that blend together harmoniously. It's the dish that keeps our regulars coming back week after week.

But here's our secret - it's all about the love and passion we put into every plate. Our kitchen team takes pride in creating something truly memorable for you.

Whether you're celebrating a special occasion or just treating yourself, this dish will not disappoint.

Ready to try it for yourself? Make a reservation today or stop by our restaurant. I promise you won't be disappointed.`,
    hooks: [
      "Want to know what dish our customers can't stop ordering?",
      "Here's the dish that put our restaurant on the map...",
      "This signature dish has a secret ingredient you'd never guess..."
    ],
    callToAction: "Ready to taste the difference? Book your table today!",
    tags: ["SignatureDish", "FoodLovers", "MustTry", "ChefSpecial"]
  },
  {
    id: "seasonal-special",
    title: "Seasonal Special Announcement",
    description: "Announce limited-time seasonal menu items",
    category: "dishes",
    icon: Sparkles,
    duration: 75,
    cuisine: "Any",
    script: `Exciting news from our kitchen! For a limited time, we're featuring something truly special on our menu.

Introducing our [Seasonal Dish Name] - a celebration of the season's freshest ingredients.

We're using [seasonal ingredients] that are at their absolute peak right now. This dish captures everything we love about this time of year.

The [description of key components] are sourced locally from [local farm/supplier], ensuring maximum freshness and flavor.

Our chef has crafted this dish to bring you [flavor profile] that you simply can't get any other time of year.

But here's the thing - this won't last forever. Once the season changes, this dish goes away until next year.

Don't miss your chance to experience this seasonal masterpiece. Available now through [end date].

Come in and taste what the season has to offer!`,
    hooks: [
      "This dish is only available for the next few weeks...",
      "Here's why seasonal eating just tastes better...",
      "The ingredient we've been waiting all year for has arrived..."
    ],
    callToAction: "Limited time only! Visit us before [end date] to try this special",
    tags: ["SeasonalMenu", "LimitedTime", "FreshIngredients", "ChefSpecial"]
  },
  
  // Behind the Scenes
  {
    id: "kitchen-tour",
    title: "Behind the Scenes Kitchen Tour",
    description: "Give customers a peek into your kitchen operations",
    category: "behind-scenes",
    icon: ChefHat,
    duration: 120,
    script: `Welcome to our kitchen! Today I'm taking you behind the scenes to show you where the magic happens.

First, let's talk about our prep station. Every morning at [time], our team starts preparing ingredients fresh. Nothing sits around here - we believe in cooking with the freshest ingredients possible.

Here's our main cooking line. You'll see our [equipment] where we [cooking technique]. The heat, the flames, the sizzle - this is where dishes come to life.

Our team is incredible. We have [number] talented cooks who've been with us for [time period]. They know every dish inside and out.

Quality control is everything. Every plate that leaves this kitchen is checked to make sure it meets our standards. We're not happy unless you're delighted.

And here's something most people don't see - our cleaning routine. A clean kitchen is a safe kitchen, and we take that seriously.

This kitchen is the heart of our restaurant. It's where passion meets skill, and where your meal is prepared with care.

Next time you dine with us, know that this is the team and the kitchen working hard to give you an amazing experience.`,
    hooks: [
      "Ever wondered what happens before your food arrives?",
      "Most restaurants won't show you their kitchen. Here's ours...",
      "The secret to great food starts in this room..."
    ],
    callToAction: "Now that you've seen the kitchen, come taste the results!",
    tags: ["BehindTheScenes", "KitchenTour", "FoodPrep", "RestaurantLife"]
  },
  {
    id: "meet-the-chef",
    title: "Meet the Chef Story",
    description: "Personal introduction from your head chef",
    category: "behind-scenes",
    icon: Users,
    duration: 90,
    script: `Hi, I'm [Chef Name], and I want to share my story with you.

I fell in love with cooking when I was [age/circumstances]. There was something magical about transforming simple ingredients into something that brought joy to people.

I trained at [culinary background] and worked at [notable experience]. But opening this restaurant was always my dream.

My cooking philosophy is simple: [philosophy]. I believe that great food doesn't need to be complicated - it needs to be made with quality ingredients and genuine care.

Every dish on our menu has a story. Some are inspired by my grandmother's recipes. Others are my own creations that I've refined over years of experimentation.

What I love most about this job is seeing your faces when you taste something that hits just right. That moment when a dish exceeds expectations - that's why I do this.

Our team shares this passion. We're not just preparing food - we're creating experiences and memories for you.

I'd love for you to come in and taste what we've created. Let me cook for you.`,
    hooks: [
      "Here's how a childhood memory became our most popular dish...",
      "Why I left a successful career to open this restaurant...",
      "The moment that changed how I think about food forever..."
    ],
    callToAction: "Come meet the team and taste the passion in every dish",
    tags: ["MeetTheChef", "ChefStory", "Passion", "FoodJourney"]
  },
  
  // Promotions
  {
    id: "happy-hour",
    title: "Happy Hour Promotion",
    description: "Promote your happy hour specials",
    category: "promotions",
    icon: Clock,
    duration: 60,
    script: `Happy hour just got happier at [Restaurant Name]!

Every [days] from [start time] to [end time], we're offering incredible deals you won't want to miss.

First, drinks. [Drink specials details]. Perfect for unwinding after work with friends or colleagues.

But we didn't forget about the food. Our happy hour menu includes [food specials]. These aren't just appetizers - these are chef-crafted dishes at prices that'll make you smile.

Our atmosphere during happy hour is perfect - lively enough for fun, relaxed enough for conversation. It's become the go-to spot for [target audience].

Here's a tip: our [popular happy hour item] sells out fast. Come early to make sure you get one.

Happy hour at [Restaurant Name] - where good food, great drinks, and better company come together.

See you at happy hour!`,
    hooks: [
      "Here's how to eat like a king for half the price...",
      "The best kept happy hour secret in [city]...",
      "Why everyone's talking about our happy hour specials..."
    ],
    callToAction: "Join us for happy hour [days] from [time]!",
    tags: ["HappyHour", "Specials", "DrinkDeals", "FoodDeals"]
  },
  {
    id: "weekend-brunch",
    title: "Weekend Brunch Feature",
    description: "Highlight your weekend brunch offerings",
    category: "promotions",
    icon: Star,
    duration: 75,
    script: `Weekends were made for brunch, and brunch was perfected at [Restaurant Name].

Every [Saturday/Sunday/Both], from [time] to [time], we transform into brunch paradise.

Let me tell you about our highlights. Our [signature brunch item] is legendary - [description]. People drive from across town just for this dish.

We've got something for everyone. Classic eggs benedict? Absolutely. Fluffy pancakes? Of course. Something more adventurous? Our [unique dish] will surprise and delight.

And let's talk about our brunch drinks. Our [mimosa flight/bloody mary bar/specialty cocktail] is the perfect way to start your weekend.

The vibe here on weekend mornings is unbeatable. Sun coming through the windows, great music, the aroma of fresh coffee and cooking - it's the perfect way to slow down and enjoy.

Pro tip: Make a reservation. Our brunch tends to fill up quickly, and we'd hate for you to miss out.

Start your weekend right with brunch at [Restaurant Name].`,
    hooks: [
      "Here's why our brunch is worth setting an alarm on the weekend...",
      "The brunch dish that has a 2-week wait list...",
      "Weekend plans? We've got you covered..."
    ],
    callToAction: "Reserve your brunch table now!",
    tags: ["WeekendBrunch", "BrunchLife", "SaturdayBrunch", "SundayFunday"]
  },
  
  // Reviews & Testimonials
  {
    id: "customer-testimonial",
    title: "Customer Testimonial Feature",
    description: "Share customer love and reviews",
    category: "testimonials",
    icon: Star,
    duration: 60,
    script: `We love hearing from our customers, and today we want to share some of that love with you.

[Customer Name] said: "[Testimonial quote]"

[Another Customer] shared: "[Testimonial quote]"

And [Customer] mentioned: "[Testimonial quote]"

Reviews like these remind us why we do what we do. Every dish we prepare, every customer we serve - it all matters.

We're not just trying to feed you - we're trying to create memorable experiences that bring you back again and again.

To everyone who's left us a review, shared our restaurant with friends, or simply smiled after a great meal - thank you. You're the reason we're here.

Haven't visited yet? Come see what everyone's talking about. We'd love to add you to our family of happy customers.`,
    hooks: [
      "Here's what our customers are saying about us...",
      "These reviews made our whole team smile...",
      "Find out why customers keep coming back..."
    ],
    callToAction: "Join our happy customers - book your table today!",
    tags: ["CustomerLove", "Reviews", "Testimonials", "5Stars"]
  }
];

export function OmahaVideoTemplates() {
  const [selectedTemplate, setSelectedTemplate] = useState<VideoTemplate | null>(null);
  const [customScript, setCustomScript] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createVideoFromTemplate = useMutation({
    mutationFn: async (videoData: any) => {
      const response = await apiRequest("POST", "/api/videos", videoData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Video Created!",
        description: "Your video has been created from the template",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      setSelectedTemplate(null);
      setCustomScript("");
      setCustomTitle("");
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create video from template",
        variant: "destructive",
      });
    },
  });

  const handleUseTemplate = (template: VideoTemplate) => {
    setSelectedTemplate(template);
    setCustomScript(template.script);
    setCustomTitle(template.title);
  };

  const handleCreateFromTemplate = () => {
    if (!selectedTemplate) return;

    createVideoFromTemplate.mutate({
      title: customTitle,
      script: customScript,
      topic: selectedTemplate.description,
      cuisine: selectedTemplate.cuisine || null,
      videoType: selectedTemplate.category === "dishes" ? "dish_showcase" : 
                 selectedTemplate.category === "behind-scenes" ? "behind_scenes" :
                 selectedTemplate.category === "promotions" ? "promotion" : "testimonial",
      duration: selectedTemplate.duration,
      tags: selectedTemplate.tags,
      status: "ready"
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Script copied to clipboard",
    });
  };

  const categorizedTemplates = {
    dishes: restaurantVideoTemplates.filter(t => t.category === "dishes"),
    "behind-scenes": restaurantVideoTemplates.filter(t => t.category === "behind-scenes"),
    promotions: restaurantVideoTemplates.filter(t => t.category === "promotions"),
    testimonials: restaurantVideoTemplates.filter(t => t.category === "testimonials"),
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground flex items-center">
          <Utensils className="mr-2 h-5 w-5" />
          Restaurant Video Templates
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Pre-built video scripts tailored for restaurant marketing
        </p>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="dishes" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dishes">Dish Spotlights</TabsTrigger>
            <TabsTrigger value="behind-scenes">Behind Scenes</TabsTrigger>
            <TabsTrigger value="promotions">Promotions</TabsTrigger>
            <TabsTrigger value="testimonials">Testimonials</TabsTrigger>
          </TabsList>
          
          <TabsContent value="dishes" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categorizedTemplates.dishes.map((template) => (
                <TemplateCard key={template.id} template={template} onUse={handleUseTemplate} />
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="behind-scenes" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categorizedTemplates["behind-scenes"].map((template) => (
                <TemplateCard key={template.id} template={template} onUse={handleUseTemplate} />
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="promotions" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categorizedTemplates.promotions.map((template) => (
                <TemplateCard key={template.id} template={template} onUse={handleUseTemplate} />
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="testimonials" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categorizedTemplates.testimonials.map((template) => (
                <TemplateCard key={template.id} template={template} onUse={handleUseTemplate} />
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Template Dialog */}
        <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
          <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-900 border border-border shadow-lg">
            <DialogHeader>
              <DialogTitle>{selectedTemplate?.title}</DialogTitle>
            </DialogHeader>
            
            {selectedTemplate && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="custom-title" className="text-sm font-medium">Video Title</Label>
                    <Input
                      id="custom-title"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      data-testid="input-custom-title"
                    />
                  </div>
                  <div className="flex items-end">
                    <Badge className="bg-blue-100 text-blue-700">
                      {selectedTemplate.duration} seconds
                    </Badge>
                    {selectedTemplate.cuisine && (
                      <Badge className="ml-2 bg-green-100 text-green-700">
                        🍽️ {selectedTemplate.cuisine}
                      </Badge>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">Video Script</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(customScript)}
                      data-testid="button-copy-script"
                    >
                      <Copy className="mr-2 h-3 w-3" />
                      Copy
                    </Button>
                  </div>
                  <Textarea
                    value={customScript}
                    onChange={(e) => setCustomScript(e.target.value)}
                    rows={15}
                    className="text-sm"
                    data-testid="textarea-custom-script"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedTemplate(null)}
                    data-testid="button-cancel-template"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateFromTemplate}
                    disabled={createVideoFromTemplate.isPending}
                    data-testid="button-create-from-template"
                  >
                    <Wand2 className="mr-2 h-4 w-4" />
                    {createVideoFromTemplate.isPending ? "Creating..." : "Create Video"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function TemplateCard({ template, onUse }: { template: VideoTemplate; onUse: (template: VideoTemplate) => void }) {
  const Icon = template.icon;
  
  return (
    <div className="border rounded-lg p-4 space-y-3" data-testid={`template-${template.id}`}>
      <div className="flex items-start space-x-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-sm">{template.title}</h3>
          <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          <Badge className="text-xs bg-blue-100 text-blue-700">
            {template.duration}s
          </Badge>
          {template.cuisine && (
            <Badge className="text-xs bg-green-100 text-green-700">
              🍽️ {template.cuisine}
            </Badge>
          )}
        </div>
        
        <Button
          size="sm"
          onClick={() => onUse(template)}
          className="text-xs h-7"
          data-testid={`use-template-${template.id}`}
        >
          <Play className="mr-1 h-3 w-3" />
          Use Template
        </Button>
      </div>
      
      <div className="text-xs text-muted-foreground">
        Tags: {template.tags.slice(0, 3).join(", ")}
        {template.tags.length > 3 && "..."}
      </div>
    </div>
  );
}
