import type { InsertScheduledPost, MarketData } from "@shared/schema";
import { PLATFORM_CONFIGS } from "@shared/platform-prompts";

export interface GeneratedContentPlan {
  posts: InsertScheduledPost[];
  metadata: {
    generatedAt: string;
    model: string;
    planDuration: string;
    userContext: string;
  };
}

export class AIContentCalendarGenerator {
  private openai: any;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async initialize() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }
    
    const { OpenAI } = await import('openai');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Generate content plan for specified number of weeks
   */
  async generateContentPlan(
    serviceAreas: string[],
    marketData: MarketData[],
    targetAudience?: string,
    specialties?: string[],
    weeks: number = 4
  ): Promise<GeneratedContentPlan> {
    if (!this.openai) {
      await this.initialize();
    }

    const days = weeks * 7;
    const areasText = serviceAreas.length > 0 ? serviceAreas.join(', ') : 'Omaha metro area';
    const audienceText = targetAudience || 'food lovers and diners';
    const specialtiesText = specialties && specialties.length > 0 
      ? ` Specialties: ${specialties.join(', ')}.` 
      : '';

    // Create market insights from actual market data
    const marketInsights = marketData.map(m => 
      `${m.neighborhood}: avg $${Math.round((m.avgPrice || 0) / 1000)}K, ${m.daysOnMarket} days on market, ${m.trend} market`
    ).join('; ');

    const fbConfig = PLATFORM_CONFIGS.facebook;
    const igConfig = PLATFORM_CONFIGS.instagram;
    const liConfig = PLATFORM_CONFIGS.linkedin;
    const xConfig = PLATFORM_CONFIGS.x;

    const prompt = `You are a social media content strategist for restaurants. Create a ${weeks}-week (${days}-day) content calendar for a restaurant in Omaha, Nebraska.

**Agent Profile:**
- Service Areas: ${areasText}
- Target Audience: ${audienceText}${specialtiesText}
- Current Market Data: ${marketInsights || 'Strong Omaha market'}

**🚨 CRITICAL: KEEP POSTS SHORT FOR MAXIMUM ENGAGEMENT 🚨**
- Users scroll fast - you have 1.7 seconds to grab attention!
- Optimal post length: 40-80 characters
- Posts under 50 chars get 66% MORE engagement
- Lead with emoji + hook, be punchy, no fluff!

**Content Strategy:**
Create exactly ${days} social media posts (one per day) that:
1. Mix content types: 40% menu highlights, 30% specials, 20% behind-the-scenes, 10% community
2. Rotate platforms: Facebook, Instagram, LinkedIn, X (Twitter)
3. Vary posting times: mornings (9-10am), afternoons (2-3pm), evenings (6-7pm)
4. Include 1-2 hashtags ONLY for Instagram
5. Keep EVERY post SHORT: 40-80 characters max!

**📊 Platform Guidelines (KEEP POSTS SHORT!):**

FACEBOOK: 40-80 chars optimal (short posts get 2x engagement)
INSTAGRAM: 40-100 chars optimal (first line is key!)  
X (TWITTER): 71-100 chars optimal (under 100 gets 36% more engagement)
LINKEDIN: 50-100 chars optimal for feed posts

**EXAMPLE GOOD POSTS (follow this length):**
✅ "🍽️ New brunch menu just dropped! Book your table now."
✅ "🔥 Friday special: Half-price appetizers 4-6pm!"
✅ "Chef's table is back this weekend. Limited spots!"
✅ "🍕 Pizza night = family night. Join us tonight!"

**EXAMPLE BAD POSTS (too long - DON'T do this):**
❌ "We are thrilled to announce our exciting new menu featuring locally-sourced ingredients..."

Return ONLY a valid JSON array with exactly ${days} posts in this structure:
[
  {
    "platform": "facebook|instagram|linkedin|x",
    "postType": "menu_highlight|special|behind_scenes|community|announcement",
    "content": "SHORT punchy post (40-80 chars!)",
    "hashtags": ["tag1"] (Instagram only, 1-2 max),
    "neighborhood": "neighborhood name or null",
    "dayOffset": day_number (0-${days-1})
  }
]`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_completion_tokens: 3000,
      });

      let responseText = completion.choices[0]?.message?.content?.trim();
      if (!responseText) {
        throw new Error('Empty response from OpenAI');
      }

      // Remove markdown code blocks if present
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?$/g, '').trim();
      } else if (responseText.startsWith('```')) {
        responseText = responseText.replace(/```\n?/g, '').trim();
      }

      const posts = JSON.parse(responseText);

      // Validate structure
      if (!Array.isArray(posts) || posts.length === 0) {
        throw new Error('Invalid response structure: expected array of posts');
      }

      const expectedPosts = weeks * 7;
      const minPosts = Math.max(5, Math.floor(expectedPosts * 0.6)); // At least 60% of expected posts
      
      if (posts.length < minPosts) {
        console.warn(`AI generated only ${posts.length} posts, expected ${expectedPosts}. Using fallback data.`);
        return this.getFallbackContentPlan(serviceAreas, marketData, weeks);
      }

      const today = new Date();

      // Validate and transform each post
      const validatedPosts: InsertScheduledPost[] = posts.map((p, index) => {
        if (!p.platform || !p.postType || !p.content) {
          throw new Error(`Invalid post at index ${index}: missing required fields`);
        }

        // Validate platform
        const validPlatforms = ['facebook', 'instagram', 'linkedin', 'x'];
        if (!validPlatforms.includes(p.platform)) {
          p.platform = 'facebook'; // Default fallback
        }

        // Validate post type
        const validTypes = ['local_market', 'neighborhood_spotlight', 'buyer_tips', 'seller_tips', 'community'];
        if (!validTypes.includes(p.postType)) {
          p.postType = 'local_market'; // Default fallback
        }

        // Calculate scheduled date
        const dayOffset = typeof p.dayOffset === 'number' ? p.dayOffset : index;
        const scheduleDate = new Date(today);
        scheduleDate.setDate(today.getDate() + dayOffset + 1); // +1 to start tomorrow
        
        // Vary posting times
        const hour = dayOffset % 3 === 0 ? 9 : (dayOffset % 3 === 1 ? 14 : 18);
        scheduleDate.setHours(hour, 0, 0, 0);

        return {
          userId: this.userId,
          platform: p.platform,
          postType: p.postType,
          content: p.content,
          hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
          scheduledFor: scheduleDate,
          status: 'pending' as const,
          isEdited: false,
          isAiGenerated: true,
          originalContent: p.content,
          neighborhood: p.neighborhood || null,
          seoScore: 75,
          metadata: { 
            aiGenerated: true,
            generatedAt: new Date().toISOString(),
          },
        };
      });

      console.log(`✅ AI generated ${weeks}-week content calendar with ${validatedPosts.length} posts for user ${this.userId}`);

      return {
        posts: validatedPosts,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: 'gpt-4o-mini',
          planDuration: `${weeks} weeks (${days} days)`,
          userContext: `Service areas: ${areasText}, Audience: ${audienceText}`,
        },
      };
    } catch (error) {
      console.error('❌ AI content calendar generation failed:', error);
      console.log('🔄 Using fallback content plan...');
      return this.getFallbackContentPlan(serviceAreas, marketData, weeks);
    }
  }

  /**
   * Legacy method - calls generateContentPlan with 4 weeks (30 days)
   */
  async generate30DayPlan(
    serviceAreas: string[],
    marketData: MarketData[],
    targetAudience?: string,
    specialties?: string[]
  ): Promise<GeneratedContentPlan> {
    return this.generateContentPlan(serviceAreas, marketData, targetAudience, specialties, 4);
  }

  /**
   * Generate fallback content plan if AI fails
   */
  getFallbackContentPlan(serviceAreas: string[], marketData: MarketData[], weeks: number = 4): GeneratedContentPlan {
    const areas = serviceAreas.length > 0 ? serviceAreas : ['Omaha'];
    const platforms = ['facebook', 'instagram', 'linkedin', 'x'];
    const today = new Date();

    const contentTemplates = [
      { type: 'local_market', content: `Food scene update: The ${areas[0]} restaurant scene continues to thrive with exciting new dishes and seasonal menus!` },
      { type: 'neighborhood_spotlight', content: `Spotlight on ${areas[0]}: Discover the culinary gems in this vibrant neighborhood. Perfect for foodies looking for authentic flavors!` },
      { type: 'dining_tips', content: `Dining tip: Make reservations for weekend dinners to ensure the best experience. Walk-ins welcome during weekdays!` },
      { type: 'chef_special', content: `Chef's special: Our seasonal menu features locally-sourced ingredients at their peak freshness. Come taste the difference!` },
      { type: 'community', content: `Love the Omaha food community! Check out the local farmers market this weekend for fresh produce and culinary inspiration. 🌽` },
    ];

    const fallbackPosts: InsertScheduledPost[] = [];
    const days = weeks * 7;

    for (let day = 0; day < days; day++) {
      const scheduleDate = new Date(today);
      scheduleDate.setDate(today.getDate() + day + 1);
      scheduleDate.setHours(9 + (day % 8), 0, 0, 0);

      const template = contentTemplates[day % contentTemplates.length];
      const platform = platforms[day % platforms.length];

      fallbackPosts.push({
        userId: this.userId,
        platform,
        postType: template.type,
        content: template.content,
        hashtags: platform === 'instagram' ? ['OmahaRestaurants', 'OmahaFood'] : [],
        scheduledFor: scheduleDate,
        status: 'pending',
        isEdited: false,
        isAiGenerated: false,
        originalContent: template.content,
        neighborhood: areas[day % areas.length],
        seoScore: 70,
        metadata: { 
          aiGenerated: false,
          fallback: true,
        },
      });
    }

    return {
      posts: fallbackPosts,
      metadata: {
        generatedAt: new Date().toISOString(),
        model: 'fallback',
        planDuration: `${weeks} weeks (${days} days)`,
        userContext: `Service areas: ${areas.join(', ')}`,
      },
    };
  }
}
