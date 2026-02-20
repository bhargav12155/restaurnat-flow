import { Router, Request, Response } from "express";
import { db } from "../db";
import { users, publicUsers } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

const router = Router();

// Admin password - Store in .env for production
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// Middleware to check admin password
const requireAdminPassword = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Admin authentication required" });
  }
  
  const password = authHeader.substring(7); // Remove "Bearer " prefix
  
  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: "Invalid admin password" });
  }
  
  next();
};

// Verify admin password
router.post("/verify", async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: "Password required" });
    }
    
    if (password === ADMIN_PASSWORD) {
      return res.json({ success: true });
    }
    
    return res.status(403).json({ error: "Invalid password" });
  } catch (error) {
    console.error("Admin verify error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get all users (both agent and public users)
router.get("/users", requireAdminPassword, async (req: Request, res: Response) => {
  try {
    // Get agent users
    const agentUsers = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        email: users.email,
        role: users.role,
        isDemo: users.isDemo,
        createdAt: users.createdAt,
        type: sql<string>`'agent'`,
      })
      .from(users);

    // Get public users
    const publicUsersList = await db
      .select({
        id: publicUsers.id,
        username: sql<string>`NULL`,
        name: publicUsers.name,
        email: publicUsers.email,
        role: publicUsers.role,
        isDemo: sql<boolean>`false`,
        createdAt: publicUsers.createdAt,
        type: sql<string>`'public'`,
        agentSlug: publicUsers.agentSlug,
        emailVerified: publicUsers.emailVerified,
      })
      .from(publicUsers);

    const allUsers = [
      ...agentUsers.map(u => ({
        ...u,
        type: 'agent',
        id: String(u.id),
      })),
      ...publicUsersList.map(u => ({
        ...u,
        type: 'public',
        id: String(u.id),
      })),
    ];

    return res.json({ users: allUsers });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Delete a user
router.delete("/users/:type/:id", requireAdminPassword, async (req: Request, res: Response) => {
  try {
    const { type, id } = req.params;

    if (type === "agent") {
      // Delete agent user
      await db.delete(users).where(eq(users.id, id));
      return res.json({ success: true, message: "Agent user deleted successfully" });
    } else if (type === "public") {
      // Delete public user
      await db.delete(publicUsers).where(eq(publicUsers.id, parseInt(id)));
      return res.json({ success: true, message: "Public user deleted successfully" });
    } else {
      return res.status(400).json({ error: "Invalid user type" });
    }
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;
