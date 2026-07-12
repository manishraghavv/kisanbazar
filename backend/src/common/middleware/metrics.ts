import { Request, Response, NextFunction } from 'express';
import promClient from 'prom-client';

// Collect default metrics (memory, CPU, event loop lag, etc.)
promClient.collectDefaultMetrics({ prefix: 'app_' });

// ── Custom Metrics ──────────────────────────────────────────────────────────

export const httpRequestDuration = new promClient.Histogram({
  name: 'app_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5, 10],
});

export const httpRequestTotal = new promClient.Counter({
  name: 'app_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpRequestInFlight = new promClient.Gauge({
  name: 'app_http_requests_in_flight',
  help: 'Number of HTTP requests currently in flight',
});

// ── Business Metrics ────────────────────────────────────────────────────────

export const activeUsersGauge = new promClient.Gauge({
  name: 'app_active_users_total',
  help: 'Number of active platform users',
  labelNames: ['role'],
});

export const totalOrdersCounter = new promClient.Counter({
  name: 'app_orders_total',
  help: 'Total number of orders placed',
  labelNames: ['status'],
});

export const khataAccountsGauge = new promClient.Gauge({
  name: 'app_khata_accounts_total',
  help: 'Number of khata accounts',
  labelNames: ['status'],
});

// ── Middleware ───────────────────────────────────────────────────────────────

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip metrics endpoint itself
  if (req.path === '/metrics') {
    next();
    return;
  }

  httpRequestInFlight.inc();

  const end = httpRequestDuration.startTimer();
  const route = req.route?.path || req.path || 'unknown';

  res.on('finish', () => {
    const labels = { method: req.method, route, status_code: String(res.statusCode) };
    end(labels);
    httpRequestTotal.inc(labels);
    httpRequestInFlight.dec();
  });

  next();
}

// ── Metrics Endpoint Handler ────────────────────────────────────────────────

export async function metricsHandler(_req: Request, res: Response): Promise<void> {
  res.set('Content-Type', promClient.register.contentType);
  const metrics = await promClient.register.metrics();
  res.end(metrics);
}
