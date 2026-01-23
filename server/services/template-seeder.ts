import { storage } from "../storage";

interface TemplateDefinition {
  slug: string;
  name: string;
  category: string;
  description: string;
  scriptTemplate: string;
  sortOrder: number;
  variables: Array<{
    key: string;
    label: string;
    fieldType: string;
    placeholder?: string;
    helperText?: string;
    required?: boolean;
    options?: string[];
    defaultValue?: string;
    orderIndex: number;
  }>;
}

const RESTAURANT_TEMPLATES: TemplateDefinition[] = [
  {
    slug: "new-menu-launch",
    name: "New Menu Launch",
    category: "menu",
    description: "Announce a new menu or seasonal specials with excitement and key details",
    sortOrder: 1,
    scriptTemplate: `🍽️ New Menu Alert! I'm thrilled to present our latest culinary creations at {{restaurant_name}} in the beautiful {{neighborhood}} neighborhood!

Our talented chef has crafted {{dish_count}} incredible new dishes featuring {{cuisine_style}} flavors.

Starting at {{price_range}}, these dishes are available for a limited time!

{{highlights}}

Ready to make a reservation? Contact us today!

I'm {{owner_name}}, and I'd love to welcome you to our restaurant.
{{call_to_action}}`,
    variables: [
      { key: "restaurant_name", label: "Restaurant Name", fieldType: "text", placeholder: "The Hungry Fork", helperText: "Your restaurant's name", required: true, orderIndex: 1 },
      { key: "neighborhood", label: "Neighborhood", fieldType: "text", placeholder: "Downtown", helperText: "Name of the neighborhood", required: true, orderIndex: 2 },
      { key: "dish_count", label: "Number of New Dishes", fieldType: "number", placeholder: "8", required: true, orderIndex: 3 },
      { key: "cuisine_style", label: "Cuisine Style", fieldType: "text", placeholder: "Mediterranean-inspired", required: true, orderIndex: 4 },
      { key: "price_range", label: "Price Range", fieldType: "text", placeholder: "$15-$35", required: true, orderIndex: 5 },
      { key: "highlights", label: "Menu Highlights", fieldType: "rich_text", placeholder: "Farm-to-table ingredients, signature cocktails, house-made pasta...", helperText: "Key features that make this menu special", required: false, orderIndex: 6 },
      { key: "owner_name", label: "Your Name", fieldType: "text", placeholder: "Chef Maria", required: true, orderIndex: 7 },
      { key: "call_to_action", label: "Call to Action", fieldType: "text", placeholder: "Call us at 402-555-1234", defaultValue: "Book your table today!", required: true, orderIndex: 8 }
    ]
  },
  {
    slug: "special-event",
    name: "Special Event Invitation",
    category: "events",
    description: "Invite guests to your upcoming restaurant event",
    sortOrder: 2,
    scriptTemplate: `🍴 You're Invited! Join us for a special event at {{restaurant_name}}!

📅 {{event_date}}
⏰ {{start_time}} - {{end_time}}

This is your chance to experience something extraordinary!

{{highlights}}

Can't make the event? No problem! We'd love to host you any time.

I'm {{owner_name}} at RestaurantFlow.
See you there!`,
    variables: [
      { key: "restaurant_name", label: "Restaurant Name", fieldType: "text", placeholder: "The Hungry Fork", required: true, orderIndex: 1 },
      { key: "event_date", label: "Event Date", fieldType: "date", placeholder: "Saturday, December 14th", required: true, orderIndex: 2 },
      { key: "start_time", label: "Start Time", fieldType: "text", placeholder: "6:00 PM", required: true, orderIndex: 3 },
      { key: "end_time", label: "End Time", fieldType: "text", placeholder: "10:00 PM", required: true, orderIndex: 4 },
      { key: "highlights", label: "Event Highlights", fieldType: "rich_text", placeholder: "Wine tasting, live music, chef's tasting menu...", helperText: "Key features to highlight", required: false, orderIndex: 5 },
      { key: "owner_name", label: "Your Name", fieldType: "text", placeholder: "Chef Maria", required: true, orderIndex: 6 }
    ]
  },
  {
    slug: "industry-update",
    name: "Industry Update",
    category: "market",
    description: "Share local restaurant industry insights and trends",
    sortOrder: 3,
    scriptTemplate: `📊 {{market_area}} Restaurant Industry Update

Here's what you need to know about the current dining scene:

💰 Average Check: {{average_check}}
📈 Industry Status: {{industry_trend}}

🍽️ For Diners:
{{diner_tip}}

👨‍🍳 For Restaurateurs:
{{owner_tip}}

The industry is always evolving, and staying informed is key to making the best dining and business decisions.

I'm {{owner_name}}, your local restaurant expert. Have questions about the dining scene? Let's connect!`,
    variables: [
      { key: "market_area", label: "Market Area", fieldType: "text", placeholder: "Downtown District", required: true, orderIndex: 1 },
      { key: "average_check", label: "Average Check", fieldType: "text", placeholder: "$45-$65", required: true, orderIndex: 2 },
      { key: "industry_trend", label: "Industry Trend", fieldType: "text", placeholder: "Growing demand for farm-to-table dining", required: true, orderIndex: 3 },
      { key: "diner_tip", label: "Tip for Diners", fieldType: "rich_text", placeholder: "Make reservations early for weekend dining!", required: true, orderIndex: 4 },
      { key: "owner_tip", label: "Tip for Restaurant Owners", fieldType: "rich_text", placeholder: "Focus on local sourcing to attract health-conscious diners!", required: true, orderIndex: 5 },
      { key: "owner_name", label: "Your Name", fieldType: "text", placeholder: "Chef Maria", required: true, orderIndex: 6 }
    ]
  },
  {
    slug: "owner-introduction",
    name: "Owner Introduction",
    category: "personal",
    description: "Introduce yourself to potential customers and build trust",
    sortOrder: 4,
    scriptTemplate: `👋 Hi there! I'm {{owner_name}}, and I'm so glad you're here!

As a restaurant professional with {{restaurant_name}}, I've been creating memorable dining experiences for {{years_experience}} years.

Our specialties include:
{{specialties}}

We proudly serve the {{service_areas}} areas, and I'm passionate about making every dining experience exceptional and memorable.

Whether you're celebrating a special occasion, looking for a casual dinner, or planning an event, we're here to serve you.

Let's connect! You can reach me at {{contact_email}}.
I can't wait to welcome you to our restaurant!`,
    variables: [
      { key: "owner_name", label: "Your Name", fieldType: "text", placeholder: "Chef Maria", required: true, orderIndex: 1 },
      { key: "restaurant_name", label: "Restaurant Name", fieldType: "text", placeholder: "The Hungry Fork", defaultValue: "RestaurantFlow Partner", required: true, orderIndex: 2 },
      { key: "years_experience", label: "Years of Experience", fieldType: "text", placeholder: "10+", required: true, orderIndex: 3 },
      { key: "specialties", label: "Your Specialties", fieldType: "rich_text", placeholder: "Farm-to-table cuisine, private events, craft cocktails...", required: true, orderIndex: 4 },
      { key: "service_areas", label: "Service Areas", fieldType: "text", placeholder: "Downtown and Midtown", required: true, orderIndex: 5 },
      { key: "contact_email", label: "Contact Email", fieldType: "text", placeholder: "chef@hungryfolk.com", required: true, orderIndex: 6 }
    ]
  },
  {
    slug: "location-spotlight",
    name: "Location Spotlight",
    category: "community",
    description: "Highlight your restaurant's neighborhood and its unique features",
    sortOrder: 5,
    scriptTemplate: `🌟 Location Spotlight: {{neighborhood_name}}

Let me tell you why {{neighborhood_name}} is the perfect place for your next dining experience!

✨ What makes our location special:
{{signature_feature}}

📊 Dining Insight:
{{recent_stat}}

🎉 Community Highlights:
{{local_event}}

If you're looking for an amazing meal in {{neighborhood_name}}, we'd love to welcome you to our restaurant.

I'm {{owner_name}}, your local culinary expert.
Call us at {{contact_phone}} to make a reservation today!`,
    variables: [
      { key: "neighborhood_name", label: "Neighborhood Name", fieldType: "text", placeholder: "Downtown Arts District", required: true, orderIndex: 1 },
      { key: "signature_feature", label: "Signature Features", fieldType: "rich_text", placeholder: "Walkable dining district, local art galleries, live entertainment...", required: true, orderIndex: 2 },
      { key: "recent_stat", label: "Recent Dining Stat", fieldType: "text", placeholder: "Voted best new restaurant in the district", required: true, orderIndex: 3 },
      { key: "local_event", label: "Local Events/Attractions", fieldType: "rich_text", placeholder: "Weekly food truck festivals, art walks, live music venues...", required: true, orderIndex: 4 },
      { key: "owner_name", label: "Your Name", fieldType: "text", placeholder: "Chef Maria", required: true, orderIndex: 5 },
      { key: "contact_phone", label: "Contact Phone", fieldType: "text", placeholder: "402-555-1234", required: true, orderIndex: 6 }
    ]
  }
];

export async function seedVideoTemplates(): Promise<void> {
  console.log("🎬 Checking video templates...");
  
  for (const templateDef of RESTAURANT_TEMPLATES) {
    const existing = await storage.getVideoTemplateBySlug(templateDef.slug);
    
    if (existing) {
      console.log(`  ✓ Template "${templateDef.name}" already exists`);
      continue;
    }

    console.log(`  → Creating template: ${templateDef.name}`);
    
    const template = await storage.createVideoTemplate({
      slug: templateDef.slug,
      name: templateDef.name,
      category: templateDef.category,
      description: templateDef.description,
      scriptTemplate: templateDef.scriptTemplate,
      sortOrder: templateDef.sortOrder,
      isActive: true,
    });

    const variablesToCreate = templateDef.variables.map((v) => ({
      templateId: template.id,
      key: v.key,
      label: v.label,
      fieldType: v.fieldType,
      placeholder: v.placeholder,
      helperText: v.helperText,
      required: v.required ?? true,
      options: v.options,
      defaultValue: v.defaultValue,
      orderIndex: v.orderIndex,
    }));

    await storage.createTemplateVariables(variablesToCreate);
    console.log(`  ✓ Created template "${templateDef.name}" with ${variablesToCreate.length} variables`);
  }

  console.log("🎬 Video templates seeding complete!");
}
