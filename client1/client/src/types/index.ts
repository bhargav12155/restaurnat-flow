// User types for authentication and context
export interface UserContext {
  userId: string;
  userType: 'agent' | 'public';
  email?: string;
  username?: string;
  agentSlug?: string;
}

// Dashboard metrics types
export interface DashboardMetrics {
  totalLeads: number;
  socialEngagement: number;
  activeListings: number;
  seoScore: number;
}

// AI Content generation types
export interface AIContentRequest {
  contentType: 'social_post' | 'blog_article' | 'property_description' | 'email_campaign';
  propertyType?: string;
  neighborhood?: string;
  keywords?: string[];
  propertyFeatures?: string;
  propertyId?: string;
}

export interface AIContentResponse {
  title?: string;
  content: string;
  suggestedKeywords: string[];
  metadata: Record<string, any>;
}

// Social media types
export interface SocialMediaPostRequest {
  content: string;
  platforms: string[];
  scheduledAt?: Date;
  aiContentId?: string;
}

export interface PlatformPostResponse {
  platform: string;
  success: boolean;
  postId?: string;
  error?: string;
}

export interface PlatformMetrics {
  facebook: {
    followers: number;
    weeklyEngagement: number;
    posts: number;
  };
  instagram: {
    followers: number;
    weeklyEngagement: number;
    posts: number;
  };
  youtube: {
    subscribers: number;
    weeklyViews: number;
    videos: number;
  };
  twitter: {
    followers: number;
    weeklyEngagement: number;
    posts: number;
  };
}

// SEO Analytics types
export interface SEOAnalysisRequest {
  url?: string;
  keywords?: string[];
}

export interface SEOAnalysisResponse {
  score: number;
  metrics: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
  keywords: Array<{
    keyword: string;
    ranking: number;
    volume: number;
    difficulty: number;
  }>;
  recommendations: string[];
}

export interface SEOMetrics {
  seoScore: number;
  monthlyVisits: number;
  topKeywords: Array<{
    keyword: string;
    ranking: number;
    trend: number;
  }>;
}

// Property types (extends the schema types)
export interface PropertyCreateRequest {
  title: string;
  description?: string;
  address: string;
  neighborhood: string;
  price: number;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  propertyType: string;
  features?: string[];
  imageUrl?: string;
}

// Calendar event types
export interface CalendarEvent {
  id: string;
  title: string;
  type: 'social_post' | 'blog_article' | 'video_upload' | 'meeting';
  date: Date;
  color: string;
  description?: string;
}

// WebSocket message types
export interface WebSocketMessage {
  type: 'ai_content_generated' | 'social_post_created' | 'new_lead' | 'property_updated' | 'seo_update';
  data: Record<string, any>;
  timestamp?: Date;
}

// Activity types (extends the schema types)
export interface ActivityDisplay {
  icon: any;
  color: string;
  bgColor: string;
  title: string;
  subtitle: string;
  time: string;
}

// File upload types
export interface FileUploadRequest {
  file: File;
  category?: 'property_images' | 'documents' | 'marketing_materials';
  propertyId?: string;
}

export interface FileUploadResponse {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
}

// Video generation types (for HeyGen integration)
export interface VideoGenerationRequest {
  script: string;
  avatar?: string;
  voice?: string;
  background?: string;
  propertyId?: string;
}

export interface VideoGenerationResponse {
  videoId: string;
  status: 'processing' | 'completed' | 'failed';
  url?: string;
  duration?: number;
  thumbnail?: string;
}

// Notification types
export interface NotificationMessage {
  id: string;
  title: string;
  description: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

// API Response wrapper types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Form validation types
export interface FormFieldError {
  field: string;
  message: string;
}

export interface ValidationResponse {
  isValid: boolean;
  errors: FormFieldError[];
}

// External API integration types
export interface ExternalAPIRequest {
  user: UserContext;
  action: string;
  data: Record<string, any>;
}

export interface ExternalAPIResponse {
  success: boolean;
  result?: any;
  error?: string;
  metadata?: Record<string, any>;
}

// Iframe embedding types
export interface IframeAuthParams {
  bypassAuth: boolean;
  userId: string;
  userType: 'agent' | 'public';
  agentSlug?: string;
  username?: string;
}

// Chart and analytics types
export interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
  percentage?: number;
}

export interface AnalyticsTimeRange {
  start: Date;
  end: Date;
  period: 'day' | 'week' | 'month' | 'quarter' | 'year';
}

// Real estate specific types
export interface NeighborhoodData {
  name: string;
  averagePrice: number;
  medianPrice: number;
  totalListings: number;
  daysOnMarket: number;
  priceChange: number;
}

export interface MarketInsight {
  type: 'price_trend' | 'inventory_level' | 'market_velocity' | 'seasonal_pattern';
  title: string;
  description: string;
  value: number;
  trend: 'up' | 'down' | 'stable';
  confidence: number;
}
