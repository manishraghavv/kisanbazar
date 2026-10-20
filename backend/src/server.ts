import express, { Express, Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import * as Sentry from '@sentry/node';
import { swaggerSpec } from './common/config/swagger';
import { AppError } from './common/errors';
import { asyncHandler } from './common/middleware/asyncHandler';
import { metricsMiddleware, metricsHandler } from './common/middleware/metrics';
import { generalLimiter } from './common/middleware/rateLimiter';
import { corsOriginCheck } from './common/config/cors';
import { initSocket } from './common/lib/socket';
import { AuthRequest } from './common/types/express.d';
import Joi from 'joi';

import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/user.routes';
import khataRoutes from './modules/khata/khata.routes';
import productRoutes from './modules/products/product.routes';
import orderRoutes from './modules/orders/order.routes';
import paymentRoutes from './modules/payments/payment.routes';
import engagementRoutes from './modules/engagement/engagement.routes';
import enterpriseRoutes from './modules/enterprise/enterprise.routes';
import addressRoutes from './modules/addresses/address.routes';
import { adminRouter, invoiceRouter, autoApplyCouponHandler } from './modules/admin/admin.routes';
import uploadRoutes from './modules/upload/upload.routes';
import bulkImportRoutes from './modules/products/bulk-import.routes';
import { handlePaymentWebhook } from './modules/payments/payment.webhook';
import { autoApplyCouponSchema, validateCouponSchema } from './modules/payments/payment.validator';

const app: Express = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Number of reverse-proxy hops (nginx) in front of the app, so req.ip is the real
// client IP and per-IP rate limits work. Production defaults to 1 (see DEPLOYMENT.md nginx config).
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? (process.env.NODE_ENV === 'production' ? 1 : 0)));

// ── Socket.io ──────────────────────────────────────────────────────────────
initSocket(httpServer);

// ── Sentry ──────────────────────────────────────────────────────────────────
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 0,
  });
}

// ── Global Middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: corsOriginCheck() }));
app.use(morgan('dev'));
// Gateway webhook needs the raw bytes for HMAC verification, so it is mounted with
// express.raw() BEFORE the JSON body parser and before any auth-guarded router.
app.post('/api/payments/webhook/:gateway', express.raw({ type: '*/*', limit: '1mb' }), asyncHandler(handlePaymentWebhook));

// Global per-IP ceiling for the API (the webhook above is HMAC-protected and exempt).
app.use('/api', generalLimiter);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Prometheus metrics (after basic middleware, before routes)
app.use(metricsMiddleware);

// API docs
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/khata', khataRoutes);
app.use('/api', productRoutes);
app.use('/api', orderRoutes);
app.use('/api', paymentRoutes);
app.use('/api', engagementRoutes);
app.use('/api', enterpriseRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api', adminRouter);
app.use('/api', invoiceRouter);
app.use('/api', uploadRoutes);
app.use('/api', bulkImportRoutes);
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));



// B.8 — Auto-apply best coupon
app.post('/api/coupons/auto-apply', (req, res, next) => {
  const { error, value } = autoApplyCouponSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: error.details.map((d: Joi.ValidationErrorItem) => ({ field: d.path.join('.'), message: d.message })),
    });
    return;
  }
  req.body = value;
  // Wrap in asyncHandler to catch async errors
  asyncHandler((req: Request, res: Response) => autoApplyCouponHandler(req as AuthRequest, res))(req, res, next);
});

// ── Metrics Endpoint ────────────────────────────────────────────────────────
app.get('/metrics', metricsHandler);

// ── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Multi-Vendor E-commerce Backend',
    uptime: process.uptime(),
  });
});

// ── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
});

// ── Global Error Handler ────────────────────────────────────────────────────
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Log unhandled errors
  console.error('[UNHANDLED ERROR]', err);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    },
  });
});

export { app, httpServer, PORT };