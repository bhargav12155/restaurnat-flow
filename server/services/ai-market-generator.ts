import type { InsertMarketData } from "@shared/schema";

export interface GeneratedMarketData {
  neighborhoods: InsertMarketData[];
  metadata: {
    generatedAt: string;
    model: string;
    prompt: string;
  };
}

export class AIMarketDataGenerator {
  private openai: any;

  async initialize() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }
    
    const { OpenAI } = await import('openai');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateOmahaMarketData(): Promise<GeneratedMarketData> {
    if (!this.openai) {
      await this.initialize();
    }

    const prompt = `You are a real estate market data analyst for Omaha, Nebraska. Generate realistic, current market statistics for major Omaha neighborhoods.

Generate data for these 10 neighborhoods: Aksarben, Dundee, Blackstone, Benson, Midtown, West Omaha, Regency, Old Market, Elkhorn, and Papillion.

For EACH neighborhood, provide:
1. **avgPrice** (integer): Average home price in dollars. Range $250,000-$850,000 depending on neighborhood desirability.
2. **daysOnMarket** (integer): Average days homes stay on market. Range 15-45 days. Hot neighborhoods = lower numbers.
3. **inventory** (string): Months of inventory supply. Format as "X.X months". Range 0.6-2.5 months. Lower = hotter market.
4. **priceGrowth** (string): Year-over-year price growth. Format as "+X.X%" or "-X.X%". Range -2% to +12%. Premium neighborhoods typically higher.
5. **trend** (string): Market trend. Must be one of: "hot", "rising", "steady", "cooling"

**IMPORTANT CONSTRAINTS:**
- Aksarben and Dundee are premium areas: higher prices ($550K-$750K), low inventory (<1.0 months), hot/rising trends
- Benson and Blackstone are trendy/gentrifying: mid-high prices ($380K-$520K), moderate inventory, rising/hot trends
- West Omaha and Regency are established: high prices ($480K-$650K), steady trends
- Old Market is urban lofts: varied prices ($320K-$580K), low inventory
- Elkhorn and Papillion are suburban: mid prices ($350K-$480K), more inventory
- Keep data realistic and internally consistent (hot markets = low days on market + low inventory)
- All neighborhoods should show overall positive growth (Omaha market is strong)

Return ONLY a valid JSON array with this exact structure:
[
  {
    "neighborhood": "neighborhood name",
    "avgPrice": integer,
    "daysOnMarket": integer,
    "inventory": "X.X months",
    "priceGrowth": "+X.X%",
    "trend": "hot|rising|steady|cooling"
  }
]`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_completion_tokens: 800,
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

      const neighborhoods = JSON.parse(responseText);

      // Validate structure
      if (!Array.isArray(neighborhoods) || neighborhoods.length === 0) {
        throw new Error('Invalid response structure: expected array of neighborhoods');
      }

      // Validate each neighborhood
      const validatedNeighborhoods = neighborhoods.map((n, index) => {
        if (!n.neighborhood || !n.avgPrice || !n.daysOnMarket || !n.inventory || !n.priceGrowth || !n.trend) {
          throw new Error(`Invalid neighborhood data at index ${index}: missing required fields`);
        }

        // Validate bounds
        if (n.avgPrice < 200000 || n.avgPrice > 1000000) {
          throw new Error(`Invalid avgPrice for ${n.neighborhood}: ${n.avgPrice} (must be 200K-1M)`);
        }

        if (n.daysOnMarket < 10 || n.daysOnMarket > 90) {
          throw new Error(`Invalid daysOnMarket for ${n.neighborhood}: ${n.daysOnMarket} (must be 10-90)`);
        }

        if (!['hot', 'rising', 'steady', 'cooling'].includes(n.trend)) {
          throw new Error(`Invalid trend for ${n.neighborhood}: ${n.trend}`);
        }

        return {
          neighborhood: n.neighborhood,
          avgPrice: n.avgPrice,
          daysOnMarket: n.daysOnMarket,
          inventory: n.inventory,
          priceGrowth: n.priceGrowth,
          trend: n.trend,
        } as InsertMarketData;
      });

      console.log(`✅ AI generated market data for ${validatedNeighborhoods.length} neighborhoods`);

      return {
        neighborhoods: validatedNeighborhoods,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: 'gpt-4o-mini',
          prompt: prompt.substring(0, 200) + '...',
        },
      };
    } catch (error) {
      console.error('❌ AI market data generation failed:', error);
      throw new Error(`Failed to generate market data: ${(error as Error).message}`);
    }
  }

  /**
   * Generate fallback market data if AI fails
   */
  getFallbackData(): GeneratedMarketData {
    const fallbackNeighborhoods: InsertMarketData[] = [
      { neighborhood: "Aksarben", avgPrice: 685000, daysOnMarket: 18, inventory: "0.8 months", priceGrowth: "+9.2%", trend: "hot" },
      { neighborhood: "Dundee", avgPrice: 625000, daysOnMarket: 21, inventory: "0.9 months", priceGrowth: "+8.7%", trend: "hot" },
      { neighborhood: "Blackstone", avgPrice: 465000, daysOnMarket: 23, inventory: "1.1 months", priceGrowth: "+7.5%", trend: "rising" },
      { neighborhood: "Benson", avgPrice: 425000, daysOnMarket: 25, inventory: "1.2 months", priceGrowth: "+6.8%", trend: "rising" },
      { neighborhood: "Midtown", avgPrice: 510000, daysOnMarket: 22, inventory: "1.0 months", priceGrowth: "+7.9%", trend: "rising" },
      { neighborhood: "West Omaha", avgPrice: 575000, daysOnMarket: 26, inventory: "1.3 months", priceGrowth: "+5.2%", trend: "steady" },
      { neighborhood: "Regency", avgPrice: 595000, daysOnMarket: 24, inventory: "1.2 months", priceGrowth: "+6.1%", trend: "steady" },
      { neighborhood: "Old Market", avgPrice: 445000, daysOnMarket: 20, inventory: "0.9 months", priceGrowth: "+8.3%", trend: "hot" },
      { neighborhood: "Elkhorn", avgPrice: 415000, daysOnMarket: 28, inventory: "1.5 months", priceGrowth: "+5.8%", trend: "steady" },
      { neighborhood: "Papillion", avgPrice: 385000, daysOnMarket: 29, inventory: "1.6 months", priceGrowth: "+5.4%", trend: "steady" },
    ];

    return {
      neighborhoods: fallbackNeighborhoods,
      metadata: {
        generatedAt: new Date().toISOString(),
        model: 'fallback',
        prompt: 'Static fallback data',
      },
    };
  }
}
