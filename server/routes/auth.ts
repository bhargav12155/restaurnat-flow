import { Request, Response, Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { optionalAuth, requireAuth, generateToken } from "../middleware/auth";
import {
  createAgent,
  createOrLoginPublicUser,
  loginAgent,
  testUserIdentification,
} from "../utils/auth";
import { db } from "../db";
import { users, publicUsers } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import {
  generateVerificationToken,
  sendVerificationEmail,
  sendWelcomeEmail,
} from "../services/email";

const router = Router();

// Validation schemas
const agentRegistrationSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.string().optional().default("agent"),
});

const agentLoginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

const publicUserSchema = z.object({
  email: z.string().email(),
  agentSlug: z.string().min(1),
  name: z.string().optional(),
});

// =====================================================
// AGENT AUTHENTICATION ROUTES
// =====================================================

/**
 * POST /api/auth/agent/register
 * Register a new restaurant owner
 */
router.post("/agent/register", async (req: Request, res: Response) => {
  try {
    const validatedData = agentRegistrationSchema.parse(req.body);

    const { user, token } = await createAgent(validatedData);

    // Set HTTP-only cookie for token (SameSite=None for iframe/mobile, conditional secure for dev)
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Always secure in production for SameSite=None
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // None for production iframe support
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      success: true,
      message: "Agent registered successfully",
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        type: "agent",
      },
      token,
    });
  } catch (error: any) {
    console.error("Agent registration error:", error);

    if (error.message.includes("already exists")) {
      return res.status(409).json({
        success: false,
        error: error.message,
      });
    }

    if (error.name === "ZodError") {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to register agent",
    });
  }
});

/**
 * POST /api/auth/agent/login
 * Login a restaurant owner
 */
router.post("/agent/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = agentLoginSchema.parse(req.body);

    const { user, token } = await loginAgent(username, password);

    // Set HTTP-only cookie for token (SameSite=None for iframe/mobile, conditional secure for dev)
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Always secure in production for SameSite=None
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // None for production iframe support
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        type: "agent",
      },
      token,
    });
  } catch (error: any) {
    console.error("Agent login error:", error);

    if (error.message.includes("Invalid username or password")) {
      return res.status(401).json({
        success: false,
        error: "Invalid username or password",
      });
    }

    if (error.name === "ZodError") {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: "Login failed",
    });
  }
});

// =====================================================
// PUBLIC USER AUTHENTICATION ROUTES
// =====================================================

/**
 * POST /api/auth/public/login
 * Create or login a public user (client/visitor)
 */
router.post("/public/login", async (req: Request, res: Response) => {
  try {
    const { email, agentSlug, name } = publicUserSchema.parse(req.body);

    const { user, token, isNewUser } = await createOrLoginPublicUser(
      email,
      agentSlug,
      name,
    );

    // Set HTTP-only cookie for token (SameSite=None for iframe/mobile, conditional secure for dev)
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Always secure in production for SameSite=None
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // None for production iframe support
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days for public users
    });

    res.json({
      success: true,
      message: isNewUser ? "Account created successfully" : "Login successful",
      isNewUser,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        agentSlug: user.agentSlug,
        type: "public",
      },
      token,
    });
  } catch (error: any) {
    console.error("Public user login error:", error);

    if (error.name === "ZodError") {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: "Authentication failed",
    });
  }
});

// =====================================================
// SHARED AUTHENTICATION ROUTES
// =====================================================

/**
 * POST /api/auth/logout
 * Logout user (clears cookie)
 */
router.post("/logout", (req: Request, res: Response) => {
  res.clearCookie("authToken");

  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get("/me", requireAuth, (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Not authenticated",
    });
  }

  res.json({
    success: true,
    user: req.user,
  });
});

/**
 * GET /api/auth/check
 * Check if user is authenticated (optional auth)
 */
router.get("/check", optionalAuth, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.json({
      success: true,
      authenticated: false,
      user: null,
    });
  }

  try {
    let enrichedUser = { ...req.user };
    
    if (req.user.type === "agent" && req.user.id) {
      const dbUser = await db.query.users.findFirst({
        where: eq(users.id, String(req.user.id)),
      });
      
      if (dbUser) {
        enrichedUser = {
          ...enrichedUser,
          name: dbUser.name,
          isDemo: dbUser.isDemo || false,
        };
      }
    }
    
    res.json({
      success: true,
      authenticated: true,
      user: enrichedUser,
    });
  } catch (error) {
    console.error("Error enriching user data:", error);
    res.json({
      success: true,
      authenticated: !!req.user,
      user: req.user,
    });
  }
});

// =====================================================
// UNIVERSAL LOGIN ROUTE
// =====================================================

/**
 * POST /api/auth/login
 * Universal login endpoint that auto-detects user type
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { identifier } = req.body;

    if (!identifier || typeof identifier !== "string") {
      return res.status(400).json({
        success: false,
        error: "User identifier is required",
      });
    }

    const cleanIdentifier = identifier.trim();
    let loginResult;

    // Strategy 1: If it contains @, treat as email for public user
    if (cleanIdentifier.includes("@")) {
      loginResult = await createOrLoginPublicUser(
        cleanIdentifier,
        "default", // Default agent slug for email-based access
        cleanIdentifier.split("@")[0], // Use part before @ as name
      );

      if (loginResult.user) {
        const token = loginResult.token!;

        // Set HTTP-only cookie for token (SameSite=None for iframe/mobile, conditional secure for dev)
        res.cookie("authToken", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production", // Always secure in production for SameSite=None
          sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // None for production iframe support
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        return res.json({
          success: true,
          message: `Welcome ${
            loginResult.isNewUser ? "to RestaurantFlow" : "back"
          }!`,
          user: {
            id: loginResult.user.id,
            email: loginResult.user.email,
            name: loginResult.user.name,
            type: "public",
            agentSlug: loginResult.user.agentSlug,
          },
          isNewUser: loginResult.isNewUser,
        });
      }
    }

    // Strategy 2: Treat as agent slug for public user access
    loginResult = await createOrLoginPublicUser(
      `${cleanIdentifier}@client.temp`,
      cleanIdentifier,
      cleanIdentifier,
    );

    if (loginResult.user) {
      const token = loginResult.token!;

      // Set HTTP-only cookie for token (SameSite=None for iframe/mobile, conditional secure for dev)
      res.cookie("authToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // Always secure in production for SameSite=None
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // None for production iframe support
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return res.json({
        success: true,
        message: `Welcome to ${cleanIdentifier}'s portal!`,
        user: {
          id: loginResult.user.id,
          email: loginResult.user.email,
          name: loginResult.user.name,
          type: "public",
          agentSlug: loginResult.user.agentSlug,
        },
        isNewUser: loginResult.isNewUser,
      });
    }

    // If we get here, no strategy worked
    return res.status(401).json({
      success: false,
      error: "Could not authenticate with the provided identifier",
    });
  } catch (error) {
    console.error("Universal login error:", error);
    res.status(500).json({
      success: false,
      error: "Authentication failed",
    });
  }
});

// =====================================================
// DEVELOPMENT/DEBUG ROUTES
// =====================================================

/**
 * POST /api/auth/test-token
 * Test token validation (development only)
 */
if (process.env.NODE_ENV === "development") {
  router.post("/test-token", (req: Request, res: Response) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: "Token required",
        });
      }

      const result = testUserIdentification(token);

      res.json({
        success: true,
        result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Token test failed",
      });
    }
  });
}

// =====================================================
// USER SIGNUP WITH EMAIL VERIFICATION
// =====================================================

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(1, "Name is required"),
});

/**
 * POST /api/auth/signup
 * Register a new user with email verification
 */
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { email, password, name } = signupSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await db.query.publicUsers.findFirst({
      where: and(
        eq(publicUsers.email, email.toLowerCase()),
        eq(publicUsers.agentSlug, "default")
      ),
    });

    if (existingUser) {
      if (existingUser.emailVerified) {
        return res.status(409).json({
          success: false,
          error: "An account with this email already exists. Please login instead.",
        });
      } else {
        // User exists but not verified - resend verification email
        const verificationToken = generateVerificationToken();
        const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await db
          .update(publicUsers)
          .set({
            verificationToken,
            verificationTokenExpiry: tokenExpiry,
            name: name || existingUser.name,
            password: await bcrypt.hash(password, 10),
          })
          .where(eq(publicUsers.id, existingUser.id));

        await sendVerificationEmail(email, name || existingUser.name || "there", verificationToken);

        return res.status(200).json({
          success: true,
          message: "A new verification email has been sent. Please check your inbox.",
          requiresVerification: true,
        });
      }
    }

    // Create new user
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = generateVerificationToken();
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const [newUser] = await db
      .insert(publicUsers)
      .values({
        email: email.toLowerCase(),
        name,
        password: hashedPassword,
        agentSlug: "default",
        emailVerified: false,
        verificationToken,
        verificationTokenExpiry: tokenExpiry,
      })
      .returning();

    // Send verification email
    const emailSent = await sendVerificationEmail(email, name, verificationToken);

    if (!emailSent) {
      console.error("Failed to send verification email to:", email);
    }

    res.status(201).json({
      success: true,
      message: "Account created! Please check your email to verify your account.",
      requiresVerification: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      },
    });
  } catch (error: any) {
    console.error("Signup error:", error);

    if (error.name === "ZodError") {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to create account. Please try again.",
    });
  }
});

/**
 * GET /api/auth/verify-email
 * Verify user's email with token
 */
router.get("/verify-email", async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(400).json({
        success: false,
        error: "Verification token is required",
      });
    }

    // Find user with this token
    const user = await db.query.publicUsers.findFirst({
      where: eq(publicUsers.verificationToken, token),
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired verification link",
      });
    }

    // Check if token is expired
    if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
      return res.status(400).json({
        success: false,
        error: "Verification link has expired. Please request a new one.",
        expired: true,
      });
    }

    // Mark email as verified
    await db
      .update(publicUsers)
      .set({
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
      })
      .where(eq(publicUsers.id, user.id));

    // Send welcome email
    await sendWelcomeEmail(user.email, user.name || "there");

    // Generate auth token and log them in
    const authToken = generateToken({
      id: user.id,
      email: user.email,
      type: "public",
    });

    // Set auth cookie
    res.cookie("authToken", authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      message: "Email verified successfully! Welcome to RestaurantFlow.",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        type: "public",
      },
    });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({
      success: false,
      error: "Verification failed. Please try again.",
    });
  }
});

/**
 * POST /api/auth/resend-verification
 * Resend verification email
 */
router.post("/resend-verification", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    const user = await db.query.publicUsers.findFirst({
      where: and(
        eq(publicUsers.email, email.toLowerCase()),
        eq(publicUsers.agentSlug, "default")
      ),
    });

    if (!user) {
      // Don't reveal if user exists or not
      return res.json({
        success: true,
        message: "If an account exists with this email, a verification link has been sent.",
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        error: "This email is already verified. Please login.",
      });
    }

    // Generate new token
    const verificationToken = generateVerificationToken();
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db
      .update(publicUsers)
      .set({
        verificationToken,
        verificationTokenExpiry: tokenExpiry,
      })
      .where(eq(publicUsers.id, user.id));

    await sendVerificationEmail(email, user.name || "there", verificationToken);

    res.json({
      success: true,
      message: "Verification email sent! Please check your inbox.",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to resend verification email.",
    });
  }
});

/**
 * POST /api/auth/login-with-password
 * Login with email and password
 */
router.post("/login-with-password", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
    }

    const user = await db.query.publicUsers.findFirst({
      where: and(
        eq(publicUsers.email, email.toLowerCase()),
        eq(publicUsers.agentSlug, "default")
      ),
    });

    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    // Check if email is verified
    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        error: "Please verify your email before logging in",
        requiresVerification: true,
        email: user.email,
      });
    }

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      type: "public",
    });

    // Update last login
    await db
      .update(publicUsers)
      .set({ lastLogin: new Date() })
      .where(eq(publicUsers.id, user.id));

    // Set cookie
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      message: "Login successful!",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        type: "public",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      error: "Login failed. Please try again.",
    });
  }
});

export default router;
