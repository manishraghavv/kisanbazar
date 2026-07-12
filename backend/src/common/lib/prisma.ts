import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
};

function createPrismaClient() {
  // Strip Prisma-only query params (e.g. ?schema=public) before passing to pg.Pool
  const rawUrl = process.env.DATABASE_URL ?? '';
  const pgUrl = rawUrl.replace(/\?.*$/, '');

  const pool = new Pool({
    connectionString: pgUrl,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 10,
    connectionTimeoutMillis: 10000,
  });

  pool.on('error', (err) => {
    console.error('[PG POOL] Unexpected error on idle client', err.message);
  });

  const adapter = new PrismaPg(pool, {
    schema: 'public',
  });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['error', 'warn']
        : ['error'],
  });
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}