/**
 * C.1 — BullMQ Queue Definitions
 *
 * Each queue handles a specific type of background job.
 * Uses the existing Redis connection (if available) or falls back gracefully.
 */

import { Queue } from 'bullmq';
import Redis from 'ioredis';

const REDIS_URL_PROCESS = process.env.REDIS_URL || process.env.REDIS_URL_QUEUES;

let redisAvailable = false;

async function testRedisConnection(): Promise<boolean> {
  if (!REDIS_URL_PROCESS) return false;

  const testClient = new Redis(REDIS_URL_PROCESS, {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    lazyConnect: true,
    connectTimeout: 3000,
  });

  try {
    await testClient.connect();
    await testClient.ping();
    redisAvailable = true;
    return true;
  } catch {
    return false;
  } finally {
    try { await testClient.quit(); } catch { /* ignore */ }
  }
}

const QUEUE_PREFIX = process.env.QUEUE_PREFIX || 'kb';

// ── Queue Factory ───────────────────────────────────────────────────────────

function createQueue(name: string): Queue | null {
  if (!redisAvailable || !REDIS_URL_PROCESS) return null;
  try {
    return new Queue(`${QUEUE_PREFIX}_${name}`, {
      connection: { url: REDIS_URL_PROCESS },
    });
  } catch (err) {
    console.warn(`[QUEUES] Failed to create queue ${name}:`, (err as Error).message);
    return null;
  }
}

// ── Queue Exports ───────────────────────────────────────────────────────────
// Queues are created only after Redis connectivity is verified.
// Call `initQueues()` before using them.

let initialized = false;

export let queues: Record<string, Queue | null> = {};

export async function initQueues(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const connected = await testRedisConnection();
  if (!connected) {
    if (REDIS_URL_PROCESS) {
      console.warn('[QUEUES] Redis is not reachable — BullMQ queues will not be available. In-memory fallback used.');
    } else {
      console.warn('[QUEUES] No REDIS_URL set — BullMQ queues will not be available. In-memory fallback used.');
    }
    queues = {
      email: null, sms: null, push: null,
      interest: null, statement: null, settlement: null, invoice: null,
    };
    return;
  }

  console.log('[QUEUES] Redis connectivity verified');

  queues = {
    email: createQueue('email'),
    sms: createQueue('sms'),
    push: createQueue('push'),
    interest: createQueue('interest'),
    statement: createQueue('statement'),
    settlement: createQueue('settlement'),
    invoice: createQueue('invoice'),
  };

  const count = Object.values(queues).filter(Boolean).length;
  console.log(`[QUEUES] ${count} queues initialized`);
}

// ── Job Data Types ───────────────────────────────────────────────────────────

export interface EmailJobData {
  to: string;
  subject: string;
  body: string;
  templateName?: string;
  templateData?: Record<string, unknown>;
}

export interface SmsJobData {
  to: string;
  message: string;
  templateName?: string;
  templateData?: Record<string, unknown>;
}

export interface PushJobData {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface InterestJobData {
  accountId?: string; // If omitted, run for all accounts
}

export interface StatementJobData {
  accountId: string;
  periodStart: string;
  periodEnd: string;
}

export interface SettlementJobData {
  vendorId: string;
  periodStart: string;
  periodEnd: string;
}

export interface InvoiceJobData {
  orderId: string;
  userId: string;
}

// ── Helper: Add a job to a queue ─────────────────────────────────────────────

const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: { age: 3600 * 24 * 7 }, // Keep for 7 days
  removeOnFail: { age: 3600 * 24 * 30 },    // Keep failures for 30 days
};

export async function addJob<T>(
  queue: Queue | null,
  jobName: string,
  data: T,
  options?: { delay?: number; jobId?: string },
): Promise<void> {
  if (!queue) {
    console.log(`[QUEUES-DEV] Job "${jobName}" submitted:`, JSON.stringify(data).slice(0, 200));
    return;
  }

  await queue.add(jobName, data, {
    ...JOB_OPTIONS,
    ...options,
  });
}

// ── Convenience Functions ────────────────────────────────────────────────────

export const JobQueue = {
  email: (data: EmailJobData) => addJob(queues.email, 'send-email', data),
  sms: (data: SmsJobData) => addJob(queues.sms, 'send-sms', data),
  push: (data: PushJobData) => addJob(queues.push, 'send-push', data),
  interest: (data?: InterestJobData) => addJob(queues.interest, 'calculate-interest', data || {}),
  statement: (data: StatementJobData) => addJob(queues.statement, 'generate-statement', data),
  settlement: (data: SettlementJobData) => addJob(queues.settlement, 'process-settlement', data),
  invoice: (data: InvoiceJobData) => addJob(queues.invoice, 'generate-invoice', data),
};
