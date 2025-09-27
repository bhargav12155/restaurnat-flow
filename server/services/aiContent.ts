import OpenAI from "openai";
import { storage } from "../storage";
import type { InsertAIContent } from "@shared/schema";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

interface ContentGenerationRequest {
  userId: string;
  contentType: 'social_post' | 'blog_article' | 'property_description' | 'email_campaign';
  propertyType?: string;
  neighborhood?: string;
  keywords?: string[];
  propertyFeatures?: string;
  propertyId?: string;
}

interface ContentGenerationResponse {
  title?: string;
  content: string;
  suggestedKeywords: string[];
  metadata: Record<string, any>;
}

export class AIContentService {
  async generateContent(request: ContentGenerationRequest): Promise<ContentGenerationResponse> {
    try {
      const prompt = this.buildPrompt(request);
      
      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025
        messages: [
          {
            role: "system",
            content: `You are an expert real estate marketing assistant specializing in the Omaha, Nebraska market. 
            You create compelling, SEO-optimized content that highlights local neighborhoods like Benson, Dundee, Midtown, and West Omaha. 
            Always respond in valid JSON format with the following structure: 
            {
              "title": "Optional title for the content",
              "content": "The main content text",
              "suggestedKeywords": ["keyword1", "keyword2"],
              "metadata": {"contentLength": number, "tone": "string", "targetAudience": "string"}
            }`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      // Save to database
      const aiContent: InsertAIContent = {
        userId: request.userId,
        contentType: request.contentType,
        title: result.title,
        content: result.content,
        keywords: result.suggestedKeywords || [],
        propertyId: request.propertyId,
        metadata: result.metadata || {}
      };

      await storage.createAIContent(aiContent);
      
      // Log user activity
      await storage.logUserActivity({
        userId: request.userId,
        action: 'ai_content_generated',
        description: `Generated ${request.contentType} content`,
        metadata: { contentType: request.contentType, neighborhood: request.neighborhood }
      });

      return result;
    } catch (error) {
      console.error('AI Content Generation Error:', error);
      throw new Error(`Failed to generate content: ${error.message}`);
    }
  }

  private buildPrompt(request: ContentGenerationRequest): string {
    const baseContext = "Create engaging real estate marketing content for the Omaha, Nebraska market.";
    
    let prompt = `${baseContext}\n\n`;
    prompt += `Content Type: ${request.contentType}\n`;
    
    if (request.propertyType) {
      prompt += `Property Type: ${request.propertyType}\n`;
    }
    
    if (request.neighborhood) {
      prompt += `Neighborhood: ${request.neighborhood} (Omaha area)\n`;
      prompt += `Include specific details about the ${request.neighborhood} neighborhood that would appeal to potential buyers.\n`;
    }
    
    if (request.propertyFeatures) {
      prompt += `Property Features: ${request.propertyFeatures}\n`;
    }
    
    if (request.keywords && request.keywords.length > 0) {
      prompt += `Target Keywords: ${request.keywords.join(', ')}\n`;
    }

    switch (request.contentType) {
      case 'social_post':
        prompt += `\nCreate an engaging social media post (150-280 characters) that showcases the property or neighborhood. 
        Include relevant hashtags for Omaha real estate. Make it shareable and attention-grabbing.`;
        break;
      case 'blog_article':
        prompt += `\nCreate a comprehensive blog article (800-1200 words) about the property or neighborhood. 
        Include market insights, local amenities, and why it's a great place to live. Optimize for SEO.`;
        break;
      case 'property_description':
        prompt += `\nCreate a compelling property description (300-500 words) that highlights key features, 
        location benefits, and appeals to potential buyers. Use persuasive language and local context.`;
        break;
      case 'email_campaign':
        prompt += `\nCreate an email campaign (400-600 words) that can be used for lead nurturing. 
        Include a compelling subject line and call-to-action. Focus on the Omaha market advantages.`;
        break;
    }

    return prompt;
  }

  async getUserContent(userId: string) {
    try {
      const content = await storage.getAIContent(userId);
      return content;
    } catch (error) {
      console.error('Error fetching user content:', error);
      throw new Error('Failed to fetch content');
    }
  }

  async getContentById(id: string, userId: string) {
    try {
      const content = await storage.getAIContentById(id, userId);
      return content;
    } catch (error) {
      console.error('Error fetching content by ID:', error);
      throw new Error('Failed to fetch content');
    }
  }
}

export const aiContentService = new AIContentService();
