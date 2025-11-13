import type { Request, Response, NextFunction } from "express";

export function searchLimiter(req: Request, res: Response, next: NextFunction) {
  // Simple pass-through middleware (no rate limiting)
  next();
}
