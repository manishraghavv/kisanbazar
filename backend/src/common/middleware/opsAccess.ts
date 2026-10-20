import crypto from 'crypto';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { authenticate, authorize } from './authMiddleware';

/**
 * Access control for operational endpoints (/metrics, /api/docs, Bull Board).
 * Open in development/test; locked down in production.
 */

const isProduction = (): boolean => process.env.NODE_ENV === 'production';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * /metrics in production: either `Authorization: Bearer $METRICS_TOKEN` (for Prometheus
 * scrapers) or an ADMIN access token. Without a valid credential: 401/403.
 */
export const requireMetricsAccess: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  if (!isProduction()) return next();

  const scrapeToken = process.env.METRICS_TOKEN;
  const header = req.headers.authorization;
  if (scrapeToken && header?.startsWith('Bearer ') && safeEqual(header.slice(7), scrapeToken)) return next();

  authenticate(req, res, (err?: unknown) => {
    if (err) return next(err);
    authorize('ADMIN')(req, res, next);
  });
};

/** Swagger UI is disabled (404) in production unless ENABLE_API_DOCS=true is set explicitly. */
export const apiDocsGate: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  if (isProduction() && process.env.ENABLE_API_DOCS !== 'true') {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` } });
    return;
  }
  next();
};

/** Bull Board is mounted in production only when ENABLE_BULL_BOARD=true (and is always ADMIN-only). */
export const isBullBoardEnabled = (): boolean => !isProduction() || process.env.ENABLE_BULL_BOARD === 'true';
