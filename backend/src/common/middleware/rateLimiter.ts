/**
 * Rate Limiting Middleware
 *
 * Three tiers:
 *   - strict:   5 req/min  (OTP, login, password reset)
 *   - auth:    10 req/min  (authenticated API calls)
 *   - general: 100 req/min (public endpoints)
 *
 * Uses an in-memory store. In production, replace with Redis-based store
 * (e.g., rate-limit-redis) for multi-instance deployments.
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
}

function createRateLimiter(config: RateLimitConfig) {
  const { windowMs, max, message } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${req.ip || req.socket.remoteAddress || 'unknown'}:${req.path}`;
    const now = Date.now();

    let entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      res.status(429).json({
        success: false,
        message: message || `Too many requests. Try again in ${retryAfter} seconds.`,
      });
      return;
    }

    next();
  };
}

// ── Pre-configured limiters ──────────────────────────────────────────────────

const defaultWindow = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;

export const strictLimiter = createRateLimiter({
  windowMs: defaultWindow,
  max: Number(process.env.RATE_LIMIT_MAX_STRICT) || 5,
  message: 'Too many requests. Please try again later.',
});

export const authLimiter = createRateLimiter({
  windowMs: defaultWindow,
  max: Number(process.env.RATE_LIMIT_MAX_AUTH) || 10,
  message: 'Too many requests. Please slow down.',
});

export const generalLimiter = createRateLimiter({
  windowMs: defaultWindow,
  max: Number(process.env.RATE_LIMIT_MAX_GENERAL) || 100,
  message: 'Too many requests. Please slow down.',
});

export default createRateLimiter;
