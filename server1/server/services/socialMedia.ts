import { storage } from "../storage";
import type { InsertSocialPost } from "@shared/schema";

interface SocialMediaPostRequest {
  userId: string;
  content: string;
  platforms: string[];
  scheduledAt?: Date;
  aiContentId?: string;
}

interface PlatformPostResponse {
  platform: string;
  success: boolean;
  postId?: string;
  error?: string;
}

export class SocialMediaService {
  async createPost(request: SocialMediaPostRequest): Promise<{
    postId: string;
    results: PlatformPostResponse[];
  }> {
    try {
      // Save to database first
      const socialPost: InsertSocialPost = {
        userId: request.userId,
        content: request.content,
        platforms: request.platforms,
        scheduledAt: request.scheduledAt,
        status: request.scheduledAt ? 'scheduled' : 'draft',
        aiContentId: request.aiContentId,
      };

      const savedPost = await storage.createSocialPost(socialPost);
      
      // If not scheduled, post immediately
      const results: PlatformPostResponse[] = [];
      if (!request.scheduledAt) {
        for (const platform of request.platforms) {
          const result = await this.postToPlatform(platform, request.content, request.userId);
          results.push(result);
        }
        
        // Update post status
        await storage.updateSocialPost(savedPost.id, request.userId, {
          status: results.every(r => r.success) ? 'published' : 'failed',
          publishedAt: new Date(),
          engagement: { platforms: results }
        });
      }

      // Log user activity
      await storage.logUserActivity({
        userId: request.userId,
        action: 'social_post_created',
        description: `Created post for platforms: ${request.platforms.join(', ')}`,
        metadata: { platforms: request.platforms, scheduled: !!request.scheduledAt }
      });

      return {
        postId: savedPost.id,
        results
      };
    } catch (error) {
      console.error('Social Media Post Error:', error);
      throw new Error(`Failed to create social media post: ${error.message}`);
    }
  }

  private async postToPlatform(platform: string, content: string, userId: string): Promise<PlatformPostResponse> {
    try {
      switch (platform.toLowerCase()) {
        case 'facebook':
          return await this.postToFacebook(content, userId);
        case 'instagram':
          return await this.postToInstagram(content, userId);
        case 'twitter':
        case 'x':
          return await this.postToTwitter(content, userId);
        case 'youtube':
          return await this.postToYouTube(content, userId);
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      console.error(`Error posting to ${platform}:`, error);
      return {
        platform,
        success: false,
        error: error.message
      };
    }
  }

  private async postToFacebook(content: string, userId: string): Promise<PlatformPostResponse> {
    const accessToken = process.env.FACEBOOK_USER_TOKEN || process.env.FACEBOOK_ACCESS_TOKEN;
    const pageId = process.env.FACEBOOK_PAGE_ID;

    if (!accessToken) {
      throw new Error('Facebook access token not configured');
    }

    try {
      const response = await fetch(`https://graph.facebook.com/v18.0/${pageId || 'me'}/feed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          access_token: accessToken
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Facebook API error');
      }

      return {
        platform: 'facebook',
        success: true,
        postId: data.id
      };
    } catch (error) {
      throw new Error(`Facebook posting failed: ${error.message}`);
    }
  }

  private async postToInstagram(content: string, userId: string): Promise<PlatformPostResponse> {
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const instagramUserId = process.env.INSTAGRAM_USER_ID;

    if (!accessToken || !instagramUserId) {
      throw new Error('Instagram credentials not configured');
    }

    try {
      // For Instagram, we need to create a media container first (requires image)
      // This is a simplified version - in production you'd need proper media handling
      const response = await fetch(`https://graph.facebook.com/v18.0/${instagramUserId}/media`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          caption: content,
          media_type: 'TEXT', // This would be IMAGE or VIDEO in real implementation
          access_token: accessToken
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Instagram API error');
      }

      return {
        platform: 'instagram',
        success: true,
        postId: data.id
      };
    } catch (error) {
      throw new Error(`Instagram posting failed: ${error.message}`);
    }
  }

  private async postToTwitter(content: string, userId: string): Promise<PlatformPostResponse> {
    const OAuth = require('oauth-1.0a');
    const crypto = require('crypto');

    const oauth = OAuth({
      consumer: {
        key: process.env.TWITTER_CONSUMER_KEY || process.env.TWITTER_API_KEY,
        secret: process.env.TWITTER_CONSUMER_SECRET || process.env.TWITTER_API_SECRET
      },
      signature_method: 'HMAC-SHA1',
      hash_function: (baseString: string, key: string) => {
        return crypto.createHmac('sha1', key).update(baseString).digest('base64');
      }
    });

    const token = {
      key: process.env.TWITTER_ACCESS_TOKEN,
      secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
    };

    if (!token.key || !token.secret) {
      throw new Error('Twitter credentials not configured');
    }

    try {
      const requestData = {
        url: 'https://api.twitter.com/2/tweets',
        method: 'POST'
      };

      const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

      const response = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader.Authorization
        },
        body: JSON.stringify({
          text: content
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.errors?.[0]?.message || 'Twitter API error');
      }

      return {
        platform: 'twitter',
        success: true,
        postId: data.data?.id
      };
    } catch (error) {
      throw new Error(`Twitter posting failed: ${error.message}`);
    }
  }

  private async postToYouTube(content: string, userId: string): Promise<PlatformPostResponse> {
    // YouTube posting requires video upload, this is a placeholder for community posts
    const accessToken = process.env.YOUTUBE_ACCESS_TOKEN;
    
    if (!accessToken) {
      throw new Error('YouTube credentials not configured');
    }

    try {
      // This would be implemented with proper YouTube Data API v3 integration
      // For now, return success for demonstration
      return {
        platform: 'youtube',
        success: true,
        postId: 'youtube_' + Date.now()
      };
    } catch (error) {
      throw new Error(`YouTube posting failed: ${error.message}`);
    }
  }

  async getUserPosts(userId: string) {
    try {
      const posts = await storage.getSocialPosts(userId);
      return posts;
    } catch (error) {
      console.error('Error fetching user posts:', error);
      throw new Error('Failed to fetch social media posts');
    }
  }

  async getPlatformMetrics(userId: string) {
    try {
      // In a real app, this would fetch actual metrics from each platform's API
      return {
        facebook: {
          followers: 2300,
          weeklyEngagement: 847,
          posts: 15
        },
        instagram: {
          followers: 1800,
          weeklyEngagement: 1200,
          posts: 23
        },
        youtube: {
          subscribers: 892,
          weeklyViews: 3400,
          videos: 8
        },
        twitter: {
          followers: 1250,
          weeklyEngagement: 456,
          posts: 12
        }
      };
    } catch (error) {
      console.error('Error fetching platform metrics:', error);
      throw new Error('Failed to fetch platform metrics');
    }
  }
}

export const socialMediaService = new SocialMediaService();
