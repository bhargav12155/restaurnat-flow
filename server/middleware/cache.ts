import type { Request, Response, NextFunction } from "express";

export function cacheMiddleware(seconds: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Simple pass-through middleware (no caching)
    next();
  };
}
