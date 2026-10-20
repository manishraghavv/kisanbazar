import Redis from 'ioredis';
import { prisma } from './prisma';

export type DependencyStatus = 'up' | 'down' | 'disabled';

export interface HealthReport {
  status: 'OK' | 'UNAVAILABLE';
  timestamp: string;
  service: string;
  uptime: number;
  checks: { database: DependencyStatus; redis: DependencyStatus };
}

export interface HealthDeps {
  checkDatabase: () => Promise<DependencyStatus>;
  checkRedis: () => Promise<DependencyStatus>;
}

const CHECK_TIMEOUT_MS = 2000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('health check timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export async function checkDatabase(): Promise<DependencyStatus> {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, CHECK_TIMEOUT_MS);
    return 'up';
  } catch {
    return 'down';
  }
}

/** Redis is optional (cache and queues degrade gracefully): without REDIS_URL it is reported as "disabled". */
export async function checkRedis(): Promise<DependencyStatus> {
  const url = process.env.REDIS_URL;
  if (!url) return 'disabled';

  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    lazyConnect: true,
    connectTimeout: CHECK_TIMEOUT_MS,
  });
  client.on('error', () => undefined); // failures are reported via the rejected promise below
  try {
    await withTimeout(
      client.connect().then(() => client.ping()),
      CHECK_TIMEOUT_MS,
    );
    return 'up';
  } catch {
    return 'down';
  } finally {
    client.disconnect();
  }
}

/** A configured dependency that is down makes the service unavailable; a disabled one does not. */
export async function buildHealthReport(
  deps: HealthDeps = { checkDatabase, checkRedis },
): Promise<{ httpStatus: number; report: HealthReport }> {
  const [database, redis] = await Promise.all([deps.checkDatabase(), deps.checkRedis()]);
  const healthy = database === 'up' && redis !== 'down';
  return {
    httpStatus: healthy ? 200 : 503,
    report: {
      status: healthy ? 'OK' : 'UNAVAILABLE',
      timestamp: new Date().toISOString(),
      service: 'Multi-Vendor E-commerce Backend',
      uptime: process.uptime(),
      checks: { database, redis },
    },
  };
}

let shuttingDown = false;
/** Called on SIGTERM/SIGINT so /ready starts failing and load balancers drain the instance. */
export function markShuttingDown(): void {
  shuttingDown = true;
}
export function isShuttingDown(): boolean {
  return shuttingDown;
}
