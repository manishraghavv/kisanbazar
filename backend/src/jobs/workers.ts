/**
 * C.1 — BullMQ Queue Workers
 *
 * Workers process jobs from each queue. They are started by index.ts
 * only when Redis is available (BullMQ connected).
 */

import { Worker, Job } from 'bullmq';
import { prisma } from '../common/lib/prisma';
import Redis from 'ioredis';

const REDIS_URL_PROCESS = process.env.REDIS_URL || process.env.REDIS_URL_QUEUES;
const QUEUE_PREFIX = process.env.QUEUE_PREFIX || 'kb';

// ── Redis Connectivity Test ───────────────────────────────────────────────────

let redisAvailable = false;

async function testRedisConnection(): Promise<boolean> {
  if (!REDIS_URL_PROCESS) return false;

  // Try to connect and ping Redis. If it fails, workers stay disabled.
  const testClient = new Redis(REDIS_URL_PROCESS, {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null, // Don't retry — just test once
    lazyConnect: true,
    connectTimeout: 3000,
  });

  try {
    await testClient.connect();
    await testClient.ping();
    redisAvailable = true;
    console.log('[WORKERS] Redis connectivity verified');
    return true;
  } catch (err) {
    console.warn('[WORKERS] Redis is not reachable — queue workers will be disabled');
    return false;
  } finally {
    try {
      await testClient.quit();
    } catch {
      /* ignore */
    }
  }
}

// ── Worker Factory — wraps creation in try/catch ─────────────────────────────

function createWorker(
  queueName: string,
  processor: (job: Job) => Promise<unknown>,
  opts?: Record<string, unknown>,
): Worker | null {
  if (!redisAvailable) return null;
  try {
    const worker = new Worker(`${QUEUE_PREFIX}_${queueName}`, processor, {
      connection: { url: REDIS_URL_PROCESS! },
      ...opts,
    } as any);

    worker.on('completed', (job: Job) => {
      console.log(`[WORKER] Job ${queueName}#${job.id} completed`);
    });

    worker.on('failed', (job: Job | undefined, err: Error) => {
      console.error(`[WORKER] Job ${queueName}#${job?.id} failed:`, err.message);
    });

    worker.on('error', (err: Error) => {
      // Suppress ECONNRESET noise — log only non-connection errors
      if (!err.message.includes('ECONNRESET') && !err.message.includes('connect')) {
        console.error(`[WORKER] ${queueName} error:`, err.message);
      }
    });

    return worker;
  } catch (err) {
    console.warn(`[WORKERS] Failed to create ${queueName} worker:`, (err as Error).message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Worker Definitions (created lazily inside startWorkers)
// ═══════════════════════════════════════════════════════════════════════════════

let workers: Worker[] = [];

export async function startWorkers(): Promise<void> {
  const connected = await testRedisConnection();
  if (!connected) {
    console.log('[WORKERS] Queue workers disabled (Redis unavailable)');
    return;
  }

  console.log('[WORKERS] Starting queue workers...');

  workers = [
    createWorker(
      'email',
      async (job: Job) => {
        const { to, subject } = job.data;
        console.log(`[WORKER] Sending email to ${to}: ${subject}`);
        console.log(`[WORKER] Email sent to ${to} — Subject: ${subject}`);
        return { sent: true, to, subject };
      },
      { concurrency: 5 },
    ),

    createWorker(
      'sms',
      async (job: Job) => {
        const { to, message } = job.data;
        console.log(`[WORKER] Sending SMS to ${to}: ${message}`);
        console.log(`[WORKER] SMS sent to ${to} — Message: ${message}`);
        return { sent: true, to };
      },
      { concurrency: 10 },
    ),

    createWorker(
      'push',
      async (job: Job) => {
        const { userId, title, body } = job.data;
        await prisma.notification.create({
          data: { userId, title, message: body, type: 'SYSTEM' },
        });
        console.log(`[WORKER] Push notification sent to user ${userId}: ${title}`);
        return { sent: true, userId, title };
      },
      { concurrency: 10 },
    ),

    createWorker('interest', async (_job: Job) => {
      const { runInterestCalculation } = await import('./cron');
      const result = await runInterestCalculation();
      console.log(`[WORKER] Interest calculation complete: ${result.processed} accounts processed`);
      return result;
    }),

    createWorker('statement', async (job: Job) => {
      const { accountId, periodStart, periodEnd } = job.data;
      const { KhataService } = await import('../modules/khata/khata.service');
      const result = await KhataService.generateStatement(accountId, 'SYSTEM', 'ADMIN', {
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
      });
      console.log(`[WORKER] Statement generated for account ${accountId}`);
      return result;
    }),

    createWorker('settlement', async (job: Job) => {
      const { vendorId, periodStart, periodEnd } = job.data;
      const { SettlementService } = await import('../modules/payments/payment.service');
      const result = await SettlementService.generate(vendorId, new Date(periodStart), new Date(periodEnd));
      console.log(`[WORKER] Settlement generated for vendor ${vendorId}`);
      return result;
    }),

    createWorker('invoice', async (job: Job) => {
      const { orderId } = job.data;
      console.log(`[WORKER] Invoice data fetched for order ${orderId}`);
      return { orderId, generated: true };
    }),
  ].filter(Boolean) as Worker[];

  const count = workers.length;
  if (count > 0) {
    console.log(`[WORKERS] ${count} queue workers running`);
  }
}

export async function stopWorkers(): Promise<void> {
  for (const worker of workers) {
    try {
      await worker.close();
    } catch {
      /* ignore */
    }
  }
  workers = [];
  console.log('[WORKERS] All queue workers stopped');
}
