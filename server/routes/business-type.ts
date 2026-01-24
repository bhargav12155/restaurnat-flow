import { Express, Request, Response } from "express";
import { db } from "../db";
import { publicUsers } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";

const businessTypeSchema = z.object({
  businessType: z.string(),
  businessSubtype: z.string().optional().default(""),
});

export function setupBusinessTypeRoutes(app: Express) {
  // Get business type settings
  app.get("/api/user/business-type", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      
      if (!user || user.type !== "public") {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const [userData] = await db
        .select({
          businessType: publicUsers.businessType,
          businessSubtype: publicUsers.businessSubtype,
        })
        .from(publicUsers)
        .where(eq(publicUsers.id, user.id))
        .limit(1);

      if (!userData) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        businessType: userData.businessType || "restaurant",
        businessSubtype: userData.businessSubtype || "fast_casual",
      });
    } catch (error) {
      console.error("Error fetching business type:", error);
      res.status(500).json({ error: "Failed to fetch business type" });
    }
  });

  // Update business type settings
  app.post("/api/user/business-type", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      console.log("[business-type POST] Request body:", req.body);
      console.log("[business-type POST] User:", user?.id);
      
      if (!user || user.type !== "public") {
        console.log("[business-type POST] Unauthorized - user type:", user?.type);
        return res.status(401).json({ error: "Unauthorized" });
      }

      const validation = businessTypeSchema.safeParse(req.body);
      if (!validation.success) {
        console.log("[business-type POST] Validation failed:", validation.error);
        return res.status(400).json({ error: "Invalid request body", details: validation.error });
      }

      const { businessType, businessSubtype } = validation.data;
      // Ensure subtype is cleared (set to empty string or null)
      const subtypeToSave = businessSubtype || null;
      console.log("[business-type POST] Updating to:", { businessType, businessSubtype: subtypeToSave });

      await db
        .update(publicUsers)
        .set({
          businessType,
          businessSubtype: subtypeToSave,
        })
        .where(eq(publicUsers.id, user.id));

      console.log("[business-type POST] Update successful");
      res.json({
        success: true,
        businessType,
        businessSubtype: subtypeToSave || "",
      });
    } catch (error) {
      console.error("[business-type POST] Error updating business type:", error);
      res.status(500).json({ error: "Failed to update business type" });
    }
  });
}
