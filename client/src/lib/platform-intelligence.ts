import {
  type ContentType,
  type AudiencePersona,
  type ContentIntent,
  type PropertyClass,
  type MarketSignals,
  type ContentProfile,
  type PlatformScore,
  type PlatformFit,
} from "@shared/schema";

interface GeneratedContent {
  content: string;
  wordCount: number;
  keywords?: string[];
}

const contentTypePatterns: Record<ContentType, RegExp[]> = {
  listing: [
    /menu item|dish|special|appetizer|entree|dessert|signature/i,
    /\$\d+\.\d{2}|price/i,
  ],
  market_update: [
    /restaurant (update|news|announcement)/i,
    /new menu|seasonal|limited time|special event/i,
  ],
  buyer_tips: [
    /dine|dining|foodie|eating out/i,
    /(tips|advice|guide) (for|to) (order|dine)/i,
  ],
  seller_tips: [
    /catering|event|private dining|group/i,
    /(tips|advice|guide) (for|to) (host|cater)/i,
  ],
  neighborhood: [
    /restaurant|location|area|neighborhood/i,
    /(dundee|aksarben|benson|old market|blackstone|elkhorn|millard)/i,
  ],
  investment: [
    /franchise|partnership|restaurant business/i,
    /catering|private events|bulk orders/i,
  ],
  testimonial: [/review|testimonial|customer (said|says)|yelp|google review/i],
  general: [],
};

const audiencePersonaPatterns: Record<AudiencePersona, RegExp[]> = {
  first_time_buyer: [
    /first.?time (visitor|diner|customer)/i,
    /new (to|customer|guest)/i,
  ],
  luxury_buyer: [
    /fine dining|upscale|premium|gourmet|chef's table/i,
    /tasting menu|prix fixe|omakase/i,
  ],
  seller: [/catering|host(ing)|private event/i, /ready to (book|host)/i],
  investor: [/franchise|partnership|restaurant owner/i],
  relocating: [/new to (town|the area)|visiting|tourist/i],
  general: [],
};

const contentIntentPatterns: Record<ContentIntent, RegExp[]> = {
  educate: [/learn|guide|tips|how to|ingredients|explained/i],
  convert: [
    /call (me|us|now)|reserve|book|order now|visit us|come in/i,
  ],
  engage: [/what do you think|share your|comment|let me know/i, /\?$/],
  inform: [/update|announcement|new|special|hours/i],
  inspire: [/delicious|mouthwatering|amazing|beautiful|stunning/i],
};

const propertyClassPatterns: Record<PropertyClass, RegExp[]> = {
  luxury: [/fine dining|upscale|gourmet|chef's table|prix fixe/i],
  mid_market: [/casual dining|family restaurant|neighborhood spot/i],
  starter: [/quick bite|casual|affordable|lunch special/i],
  investment: [/catering|events|franchise/i],
  general: [],
};

export function classifyContent(content: GeneratedContent): ContentProfile {
  const text = content.content.toLowerCase();

  const detectType = (
    patterns: Record<string, RegExp[]>,
    defaultValue: string
  ): string => {
    for (const [key, regexes] of Object.entries(patterns)) {
      if (regexes.some((regex) => regex.test(text))) {
        return key;
      }
    }
    return defaultValue;
  };

  return {
    contentType: detectType(contentTypePatterns, "general") as ContentType,
    audiencePersona: detectType(
      audiencePersonaPatterns,
      "general"
    ) as AudiencePersona,
    intent: detectType(contentIntentPatterns, "inform") as ContentIntent,
    propertyClass: detectType(
      propertyClassPatterns,
      "general"
    ) as PropertyClass,
    hasEmojis: /[\uD83C-\uDBFF\uDC00-\uDFFF]|[\u2600-\u27FF]/.test(
      content.content
    ),
    hasHashtags: content.content.includes("#"),
    hasNumbers: /\d/.test(content.content),
    hasQuestions: content.content.includes("?"),
    hasCallToAction:
      /call|contact|schedule|visit|learn more|click|sign up/i.test(text),
    wordCount: content.wordCount,
  };
}

const baseContentFitMatrix: Record<
  string,
  Record<ContentType, number>
> = {
  Instagram: {
    listing: 35,
    market_update: 15,
    buyer_tips: 30,
    seller_tips: 25,
    neighborhood: 40,
    investment: 20,
    testimonial: 35,
    general: 25,
  },
  Facebook: {
    listing: 30,
    market_update: 35,
    buyer_tips: 35,
    seller_tips: 35,
    neighborhood: 30,
    investment: 25,
    testimonial: 40,
    general: 30,
  },
  LinkedIn: {
    listing: 25,
    market_update: 45,
    buyer_tips: 35,
    seller_tips: 35,
    neighborhood: 30,
    investment: 50,
    testimonial: 35,
    general: 35,
  },
  "X (Twitter)": {
    listing: 25,
    market_update: 40,
    buyer_tips: 30,
    seller_tips: 30,
    neighborhood: 25,
    investment: 30,
    testimonial: 20,
    general: 30,
  },
  TikTok: {
    listing: 40,
    market_update: 25,
    buyer_tips: 35,
    seller_tips: 30,
    neighborhood: 45,
    investment: 20,
    testimonial: 30,
    general: 30,
  },
  YouTube: {
    listing: 30,
    market_update: 30,
    buyer_tips: 40,
    seller_tips: 40,
    neighborhood: 35,
    investment: 35,
    testimonial: 25,
    general: 30,
  },
};

export function calculateMarketSignals(
  marketData?: any[]
): MarketSignals {
  if (!marketData || !Array.isArray(marketData) || marketData.length === 0) {
    return {
      inventoryHeat: "balanced",
      priceMomentum: "stable",
      daysOnMarketTrend: "normal",
    };
  }

  const inventoryValues = marketData
    .map((m) => {
      if (!m.inventory) return 0;
      const match = m.inventory.match(/([\d.]+)/);
      return match ? parseFloat(match[1]) : 0;
    })
    .filter((v) => !isNaN(v) && v > 0);

  const avgInventory =
    inventoryValues.length > 0
      ? inventoryValues.reduce((sum, v) => sum + v, 0) / inventoryValues.length
      : 3;

  const priceChanges = marketData
    .map((m) => {
      if (!m.priceGrowth) return 0;
      const match = m.priceGrowth.match(/([+-]?[\d.]+)/);
      return match ? parseFloat(match[1]) : 0;
    })
    .filter((v) => !isNaN(v));

  const avgPriceChange =
    priceChanges.length > 0
      ? priceChanges.reduce((sum, v) => sum + v, 0) / priceChanges.length
      : 0;

  const daysOnMarketValues = marketData
    .map((m) => m.daysOnMarket || 0)
    .filter((v) => !isNaN(v) && v > 0);

  const avgDaysOnMarket =
    daysOnMarketValues.length > 0
      ? daysOnMarketValues.reduce((sum, v) => sum + v, 0) /
        daysOnMarketValues.length
      : 30;

  return {
    inventoryHeat:
      avgInventory < 3 ? "hot" : avgInventory < 6 ? "balanced" : "cold",
    priceMomentum:
      avgPriceChange > 2 ? "rising" : avgPriceChange < -2 ? "falling" : "stable",
    daysOnMarketTrend:
      avgDaysOnMarket < 20 ? "fast" : avgDaysOnMarket < 40 ? "normal" : "slow",
  };
}

function getFitLevel(score: number): PlatformFit {
  if (score >= 80) return "excellent";
  if (score >= 60) return "very-good";
  if (score >= 40) return "good";
  return "fair";
}

export function scorePlatform(
  platform: string,
  profile: ContentProfile,
  signals: MarketSignals
): PlatformScore {
  let score =
    baseContentFitMatrix[platform]?.[profile.contentType] || 25;
  const reasons: string[] = [];

  if (platform === "Instagram") {
    if (profile.hasEmojis) {
      score += 15;
      reasons.push("Visual engagement with emojis");
    }
    if (profile.hasHashtags) {
      score += 15;
      reasons.push("Hashtag discovery potential");
    }
    if (profile.wordCount <= 150) {
      score += 10;
      reasons.push("Concise format ideal for Instagram");
    }
    if (signals.inventoryHeat === "hot") {
      score += 10;
      reasons.push("Hot market = visual urgency works on Instagram");
    }
  } else if (platform === "Facebook") {
    if (profile.intent === "engage") {
      score += 15;
      reasons.push("Engagement-focused content fits Facebook community");
    }
    if (profile.wordCount >= 100 && profile.wordCount <= 300) {
      score += 10;
      reasons.push("Optimal length for Facebook posts");
    }
    if (profile.hasQuestions) {
      score += 10;
      reasons.push("Questions drive Facebook engagement");
    }
    if (profile.contentType === "neighborhood") {
      score += 10;
      reasons.push("Local content performs well in Facebook groups");
    }
  } else if (platform === "LinkedIn") {
    if (profile.audiencePersona === "luxury_buyer" || profile.audiencePersona === "investor") {
      score += 20;
      reasons.push("Professional audience aligns with LinkedIn");
    }
    if (profile.intent === "educate" || profile.intent === "inform") {
      score += 15;
      reasons.push("Educational content valued on LinkedIn");
    }
    if (profile.wordCount >= 100) {
      score += 15;
      reasons.push("Detailed content performs well on LinkedIn");
    }
    if (profile.contentType === "market_update" || profile.contentType === "neighborhood") {
      score += 10;
      reasons.push("Market insights and local expertise valued on LinkedIn");
    }
    if (profile.hasNumbers) {
      score += 10;
      reasons.push("Data-driven content builds credibility on LinkedIn");
    }
    score += 5;
    reasons.push("Professional restaurant content fits LinkedIn");
  } else if (platform === "X (Twitter)") {
    if (profile.wordCount <= 200) {
      score += 15;
      reasons.push("Concise format perfect for Twitter");
    }
    if (profile.hasHashtags) {
      score += 15;
      reasons.push("Hashtags essential for Twitter discovery");
    }
    if (profile.contentType === "menu_feature") {
      score += 10;
      reasons.push("Real-time menu updates fit Twitter's fast pace");
    }
  } else if (platform === "TikTok") {
    if (profile.wordCount <= 150) {
      score += 15;
      reasons.push("Short-form content ideal for TikTok captions");
    }
    if (profile.hasEmojis) {
      score += 15;
      reasons.push("Emojis increase TikTok engagement");
    }
    if (
      profile.contentType === "menu_feature" ||
      profile.contentType === "restaurant_tour"
    ) {
      score += 15;
      reasons.push("Visual food content performs well on TikTok");
    }
    if (profile.audiencePersona === "first_time_buyer") {
      score += 10;
      reasons.push("TikTok's younger audience loves discovering new restaurants");
    }
  } else if (platform === "YouTube") {
    if (profile.wordCount >= 300) {
      score += 15;
      reasons.push("Detailed description benefits YouTube SEO");
    }
    if (profile.intent === "educate") {
      score += 15;
      reasons.push("Educational content thrives on YouTube");
    }
    if (profile.hasNumbers) {
      score += 10;
      reasons.push("Data-driven content performs well on YouTube");
    }
  }

  score = Math.min(100, Math.max(0, score));

  let optimization = "";
  if (platform === "Instagram") {
    optimization = profile.hasHashtags
      ? "Add food photos or behind-the-scenes content"
      : "Add hashtags like #Foodie #RestaurantLife";
  } else if (platform === "Facebook") {
    optimization = profile.hasQuestions
      ? "Share to local food groups"
      : "Add engagement question at the end";
  } else if (platform === "LinkedIn") {
    optimization =
      "Frame as professional insight: 'As a restaurant professional...'";
  } else if (platform === "X (Twitter)") {
    optimization = "Add trending local hashtags like #FoodieFinds";
  } else if (platform === "TikTok") {
    optimization = "Create quick dish reveal or kitchen tour with trending audio";
  } else if (platform === "YouTube") {
    optimization = "Create detailed cooking tutorial or restaurant tour video";
  }

  return {
    platform,
    score,
    fit: getFitLevel(score),
    reasons: reasons.length > 0 ? reasons : ["Good platform for this content"],
    optimization,
    confidence: Math.round(score / 10) / 10,
  };
}
