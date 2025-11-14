import type { Request, Response, NextFunction } from "express";

export async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  // Simple pass-through for now
  next();
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  // Simple pass-through for now
  next();
}
