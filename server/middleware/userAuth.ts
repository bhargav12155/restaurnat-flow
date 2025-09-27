import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface UserContext {
  userId: string;
  userType: 'agent' | 'public';
  email?: string;
  username?: string;
  agentSlug?: string;
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userType?: 'agent' | 'public';
      userContext?: UserContext;
      username?: string;
      agentSlug?: string;
    }
  }
}

// Extract user ID from JWT token (supports both NebraskaHomeHub and iframe embedding)
export const extractUserId = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check for URL-based bypass for iframe embedding
    const bypassAuth = req.query.bypassAuth === 'true';
    const urlUserId = req.query.userId as string;
    const urlUserType = req.query.userType as 'agent' | 'public';

    if (bypassAuth && urlUserId && urlUserType) {
      // Iframe embedding mode - extract from URL parameters
      req.userId = urlUserId;
      req.userType = urlUserType;
      req.userContext = {
        userId: urlUserId,
        userType: urlUserType,
      };
      
      // Extract agentSlug for both user types (needed for context)
      req.agentSlug = req.query.agentSlug as string;
      
      // Extract username for agents if provided
      if (urlUserType === 'agent') {
        req.username = req.query.username as string || req.query.agentSlug as string;
      }
      
      return next();
    }

    // Standard JWT token authentication
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.cookies?.authToken ||
                  req.headers['x-auth-token'] as string;
    
    if (!token) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET not configured');
      return res.status(500).json({ error: 'Authentication configuration error' });
    }

    const decoded = jwt.verify(token, jwtSecret) as any;
    
    // Determine user type and extract ID
    if (decoded.type === 'public') {
      req.userId = decoded.id; // Public user ID
      req.userType = 'public';
      req.agentSlug = decoded.agentSlug;
      req.userContext = {
        userId: decoded.id,
        userType: 'public',
        email: decoded.email,
        agentSlug: decoded.agentSlug,
      };
    } else {
      req.userId = decoded.id; // Main user (agent) ID
      req.userType = 'agent';
      req.username = decoded.username;
      req.userContext = {
        userId: decoded.id,
        userType: 'agent',
        email: decoded.email,
        username: decoded.username,
      };
    }
    
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ 
      error: 'Invalid authentication token',
      details: error.message 
    });
  }
};

// Build user payload for external AI SEO service calls
export const buildUserPayload = (req: Request) => {
  if (!req.userContext) {
    throw new Error('User context not available - ensure extractUserId middleware is used');
  }

  const basePayload = {
    userId: req.userContext.userId,
    userType: req.userContext.userType,
  };

  // Add type-specific context
  if (req.userContext.userType === 'public') {
    return {
      ...basePayload,
      agentSlug: req.userContext.agentSlug,
      context: 'client',
    };
  } else {
    return {
      ...basePayload,
      username: req.userContext.username,
      context: 'agent',
    };
  }
};

// Call external AI SEO service with user identification
export const callAiSeoService = async (req: Request, additionalParams: Record<string, any> = {}) => {
  const AI_SEO_SERVICE_URL = process.env.AI_SEO_SERVICE_URL;
  const AI_SEO_SERVICE_API_KEY = process.env.AI_SEO_SERVICE_API_KEY;

  if (!AI_SEO_SERVICE_URL) {
    throw new Error('AI SEO Service URL not configured');
  }

  const userPayload = buildUserPayload(req);
  
  const apiPayload = {
    user: userPayload,
    ...additionalParams
  };

  try {
    const response = await fetch(`${AI_SEO_SERVICE_URL}/api/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(AI_SEO_SERVICE_API_KEY && {
          'Authorization': `Bearer ${AI_SEO_SERVICE_API_KEY}`
        })
      },
      body: JSON.stringify(apiPayload)
    });

    if (!response.ok) {
      throw new Error(`AI SEO Service responded with ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('AI SEO Service Error:', error);
    throw new Error(`Failed to call AI SEO service: ${error.message}`);
  }
};

// Get user details by ID (works for both user types)
export const getUserById = async (userId: string, userType: 'agent' | 'public') => {
  const { storage } = await import('../storage');
  
  try {
    const user = await storage.getUser(userId);
    return user;
  } catch (error) {
    console.error(`Error fetching ${userType} user ${userId}:`, error);
    throw new Error('Failed to fetch user details');
  }
};

// Get user's content for SEO processing
export const getUserContent = async (userId: string, userType: 'agent' | 'public') => {
  const { storage } = await import('../storage');
  
  try {
    if (userType === 'agent') {
      // Get agent's properties, AI content, etc.
      const [properties, aiContent, socialPosts] = await Promise.all([
        storage.getProperties(userId),
        storage.getAIContent(userId),
        storage.getSocialPosts(userId)
      ]);
      
      return { 
        properties, 
        aiContent, 
        socialPosts,
        userType: 'agent' 
      };
    } else {
      // For public users, get limited data
      const activity = await storage.getUserActivity(userId, 10);
      
      return { 
        activity,
        userType: 'public' 
      };
    }
  } catch (error) {
    console.error(`Error fetching content for ${userType} user ${userId}:`, error);
    throw new Error('Failed to fetch user content');
  }
};
