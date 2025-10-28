import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { extractUserId, callAiSeoService } from "./middleware/userAuth";
import { aiContentService } from "./services/aiContent";
import { socialMediaService } from "./services/socialMedia";
import { seoAnalyticsService } from "./services/seoAnalytics";
import { insertPropertySchema, insertSEOKeywordSchema } from "@shared/schema";

// Store active WebSocket connections by user
const userConnections = new Map<string, Set<WebSocket>>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware setup
  await setupAuth(app);

  // Auth routes - supports both standard auth and URL parameter bypass
  app.get('/api/auth/user', extractUserId, async (req: any, res) => {
    try {
      let userId: string;
      let userType: string = 'agent';
      let userContext: any = {};

      // Check if this is a URL parameter bypass request
      if (req.userId && req.userType) {
        // URL parameter bypass mode
        userId = req.userId;
        userType = req.userType;
        userContext = req.userContext || {};
        
        // Return mock user data for bypass mode since we don't store these users in DB
        const mockUser = {
          id: userId,
          userType: userType,
          agentSlug: req.agentSlug || req.username,
          email: `${userId}@example.com`,
          name: userType === 'agent' ? `Agent ${userId}` : `User ${userId}`,
          context: userContext
        };
        
        return res.json(mockUser);
      } else if (req.user && req.user.claims) {
        // Standard Replit Auth mode
        userId = req.user.claims.sub;
        const user = await storage.getUser(userId);
        return res.json(user);
      } else {
        // No authentication found
        return res.status(401).json({ message: "Unauthorized" });
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Dashboard metrics endpoint
  app.get('/api/dashboard/metrics', extractUserId, async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics(req.userId!);
      res.json(metrics);
    } catch (error) {
      console.error('Dashboard metrics error:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
    }
  });

  // AI Content Generation routes
  app.post('/api/ai/generate-content', extractUserId, async (req, res) => {
    try {
      const { contentType, propertyType, neighborhood, keywords, propertyFeatures, propertyId } = req.body;

      if (!contentType) {
        return res.status(400).json({ error: 'Content type is required' });
      }

      const result = await aiContentService.generateContent({
        userId: req.userId!,
        contentType,
        propertyType,
        neighborhood,
        keywords,
        propertyFeatures,
        propertyId
      });

      // Notify connected clients via WebSocket
      const userSockets = userConnections.get(req.userId!);
      if (userSockets) {
        const notification = {
          type: 'ai_content_generated',
          data: { contentType, title: result.title }
        };
        userSockets.forEach(socket => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(notification));
          }
        });
      }

      res.json(result);
    } catch (error) {
      console.error('AI content generation error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/ai/content', extractUserId, async (req, res) => {
    try {
      const content = await aiContentService.getUserContent(req.userId!);
      res.json(content);
    } catch (error) {
      console.error('Get AI content error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Social Media routes
  app.post('/api/social/post', extractUserId, async (req, res) => {
    try {
      const { content, platforms, scheduledAt, aiContentId } = req.body;

      if (!content || !platforms || platforms.length === 0) {
        return res.status(400).json({ error: 'Content and platforms are required' });
      }

      const result = await socialMediaService.createPost({
        userId: req.userId!,
        content,
        platforms,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        aiContentId
      });

      // Notify via WebSocket
      const userSockets = userConnections.get(req.userId!);
      if (userSockets) {
        const notification = {
          type: 'social_post_created',
          data: { platforms, success: result.results.every(r => r.success) }
        };
        userSockets.forEach(socket => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(notification));
          }
        });
      }

      res.json(result);
    } catch (error) {
      console.error('Social media post error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/social/posts', extractUserId, async (req, res) => {
    try {
      const posts = await socialMediaService.getUserPosts(req.userId!);
      res.json(posts);
    } catch (error) {
      console.error('Get social posts error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/social/metrics', extractUserId, async (req, res) => {
    try {
      const metrics = await socialMediaService.getPlatformMetrics(req.userId!);
      res.json(metrics);
    } catch (error) {
      console.error('Get social metrics error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Property Management routes
  app.get('/api/properties', extractUserId, async (req, res) => {
    try {
      const properties = await storage.getProperties(req.userId!);
      res.json(properties);
    } catch (error) {
      console.error('Get properties error:', error);
      res.status(500).json({ error: 'Failed to fetch properties' });
    }
  });

  app.post('/api/properties', extractUserId, async (req, res) => {
    try {
      const propertyData = insertPropertySchema.parse({
        ...req.body,
        userId: req.userId!
      });

      const property = await storage.createProperty(propertyData);
      
      await storage.logUserActivity({
        userId: req.userId!,
        action: 'property_created',
        description: `Added new property: ${property.title}`,
        metadata: { propertyId: property.id, address: property.address }
      });

      res.status(201).json(property);
    } catch (error) {
      console.error('Create property error:', error);
      res.status(500).json({ error: 'Failed to create property' });
    }
  });

  app.get('/api/properties/:id', extractUserId, async (req, res) => {
    try {
      const property = await storage.getProperty(req.params.id, req.userId!);
      if (!property) {
        return res.status(404).json({ error: 'Property not found' });
      }
      res.json(property);
    } catch (error) {
      console.error('Get property error:', error);
      res.status(500).json({ error: 'Failed to fetch property' });
    }
  });

  // SEO Analytics routes
  app.post('/api/seo/analyze', extractUserId, async (req, res) => {
    try {
      const { url, keywords } = req.body;
      
      const analysis = await seoAnalyticsService.analyzeSite({
        userId: req.userId!,
        url,
        keywords
      });

      res.json(analysis);
    } catch (error) {
      console.error('SEO analysis error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/seo/keywords', extractUserId, async (req, res) => {
    try {
      const keywords = await seoAnalyticsService.getUserKeywords(req.userId!);
      res.json(keywords);
    } catch (error) {
      console.error('Get SEO keywords error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/seo/keywords', extractUserId, async (req, res) => {
    try {
      const keywordData = insertSEOKeywordSchema.parse({
        ...req.body,
        userId: req.userId!
      });

      const keyword = await seoAnalyticsService.addKeyword(
        req.userId!,
        keywordData.keyword,
        keywordData.url
      );

      res.status(201).json(keyword);
    } catch (error) {
      console.error('Add SEO keyword error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/seo/metrics', extractUserId, async (req, res) => {
    try {
      const metrics = await seoAnalyticsService.getSiteMetrics(req.userId!);
      res.json(metrics);
    } catch (error) {
      console.error('Get SEO metrics error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // User Activity routes
  app.get('/api/activity', extractUserId, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const activity = await storage.getUserActivity(req.userId!, limit);
      res.json(activity);
    } catch (error) {
      console.error('Get user activity error:', error);
      res.status(500).json({ error: 'Failed to fetch user activity' });
    }
  });

  // External AI SEO integration example
  app.post('/api/generate-seo-content', extractUserId, async (req, res) => {
    try {
      const { contentType, keywords, targetUrl } = req.body;

      // Call AI SEO service with user identification
      const seoResult = await callAiSeoService(req, {
        contentType,
        keywords,
        targetUrl,
        // Additional context based on user type
        ...(req.userType === 'agent' && {
          agentProfile: {
            customSlug: req.username,
            publicProfileEnabled: true
          }
        })
      });

      res.json({
        success: true,
        userId: req.userId,
        userType: req.userType,
        seoContent: seoResult
      });

    } catch (error) {
      console.error('SEO generation failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate SEO content',
        details: error.message
      });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  // Setup WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    console.log('WebSocket connection established');

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'authenticate' && data.userId) {
          // Associate WebSocket with user
          if (!userConnections.has(data.userId)) {
            userConnections.set(data.userId, new Set());
          }
          userConnections.get(data.userId)!.add(ws);
          
          // Send confirmation
          ws.send(JSON.stringify({
            type: 'authenticated',
            userId: data.userId
          }));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      // Remove WebSocket from all user connections
      userConnections.forEach((sockets, userId) => {
        sockets.delete(ws);
        if (sockets.size === 0) {
          userConnections.delete(userId);
        }
      });
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  return httpServer;
}
