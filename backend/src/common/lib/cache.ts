/**
 * Cache Utility
 *
 * Provides a Redis-backed caching layer with an in-memory fallback.
 * In production, set REDIS_URL to enable Redis. Falls back to a simple
 * Map-based cache when Redis is unavailable.
 *
 * Usage:
 *   import { cache } from '../lib/cache';
 *   const products = await cache.getOrSet('products:featured', () => fetchProducts(), 300);
 */

type CacheValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

interface CacheAdapter {
  get: (key: string) => Promise<CacheValue | undefined>;
  set: (key: string, value: CacheValue, ttlSeconds: number) => Promise<void>;
  del: (key: string) => Promise<void>;
  delPattern: (pattern: string) => Promise<void>;
}

// ── In-Memory Fallback ───────────────────────────────────────────────────────

class MemoryCache implements CacheAdapter {
  private store = new Map<string, { value: CacheValue; expiresAt: number }>();

  // Cleanup every 60 seconds
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store.entries()) {
        if (entry.expiresAt <= now) {
          this.store.delete(key);
        }
      }
    }, 60_000);
    this.cleanupTimer.unref();
  }

  async get(key: string): Promise<CacheValue | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async set(key: string, value: CacheValue, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async delPattern(pattern: string): Promise<void> {
    // Convert glob-style pattern to regex
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
      }
    }
  }
}

// ── Redis Adapter ────────────────────────────────────────────────────────────

let redisAdapter: CacheAdapter | null = null;

async function getRedisAdapter(): Promise<CacheAdapter | null> {
  if (redisAdapter) return redisAdapter;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    const { createClient } = await import('redis');
    const client = createClient({ url });

    client.on('error', (err: Error) => {
      console.warn('[CACHE] Redis error, falling back to memory cache:', err.message);
    });

    await client.connect();

    redisAdapter = {
      async get(key: string): Promise<CacheValue | undefined> {
        const val = await client.get(key);
        if (val === null) return undefined;
        try {
          return JSON.parse(val);
        } catch {
          return val as CacheValue | undefined;
        }
      },
      async set(key: string, value: CacheValue, ttlSeconds: number): Promise<void> {
        const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
        await client.setEx(key, ttlSeconds, str);
      },
      async del(key: string): Promise<void> {
        await client.del(key);
      },
      async delPattern(pattern: string): Promise<void> {
        // SCAN for keys matching pattern
        let cursor = '0';
        do {
          const result = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
          cursor = result.cursor;
          if (result.keys.length > 0) {
            await client.del(result.keys);
          }
        } while (cursor !== '0');
      },
    };

    return redisAdapter;
  } catch (err) {
    console.warn('[CACHE] Failed to connect to Redis, using in-memory cache:', (err as Error).message);
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

let memoryCache: MemoryCache | null = null;
let activeAdapter: CacheAdapter | null = null;

async function getAdapter(): Promise<CacheAdapter> {
  if (activeAdapter) return activeAdapter;

  // Try Redis first
  const redis = await getRedisAdapter();
  if (redis) {
    activeAdapter = redis;
    return redis;
  }

  // Fall back to in-memory
  if (!memoryCache) {
    memoryCache = new MemoryCache();
  }
  activeAdapter = memoryCache;
  return memoryCache;
}

export const cache = {
  async get(key: string): Promise<CacheValue | undefined> {
    const adapter = await getAdapter();
    return adapter.get(key);
  },

  async set(key: string, value: CacheValue, ttlSeconds: number = 300): Promise<void> {
    const adapter = await getAdapter();
    return adapter.set(key, value, ttlSeconds);
  },

  async del(key: string): Promise<void> {
    const adapter = await getAdapter();
    return adapter.del(key);
  },

  async delPattern(pattern: string): Promise<void> {
    const adapter = await getAdapter();
    return adapter.delPattern(pattern);
  },

  /**
   * Get a value from cache, or compute and cache it if missing.
   *
   * @param key - Cache key
   * @param fetcher - Async function to compute the value if cache miss
   * @param ttlSeconds - Time-to-live in seconds (default: 5 min)
   */
  async getOrSet<T extends CacheValue>(key: string, fetcher: () => Promise<T>, ttlSeconds: number = 300): Promise<T> {
    const cached = await this.get(key);
    if (cached !== undefined) return cached as T;

    const value = await fetcher();
    await this.set(key, value, ttlSeconds);
    return value;
  },

  /**
   * Invalidate cache keys matching common patterns.
   * Use this after mutations (e.g., product update → invalidate products:*)
   */
  invalidate: {
    products: () => cache.delPattern('products:*'),
    categories: () => cache.delPattern('categories:*'),
    khata: (accountId: string) => cache.delPattern(`khata:${accountId}:*`),
    user: (userId: string) => cache.delPattern(`users:${userId}:*`),
  },
};

export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 1800, // 30 minutes
  DAY: 86400, // 24 hours
};
