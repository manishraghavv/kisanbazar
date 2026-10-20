import { describe, it, expect } from 'vitest';
import { createRateLimiter } from './rateLimiter';

function run(limiter: ReturnType<typeof createRateLimiter>, ip: string, path = '/login') {
  const req = { ip, path, baseUrl: '/api/auth', socket: { remoteAddress: ip } } as any;
  const res = {
    statusCode: 200,
    headers: {} as Record<string, unknown>,
    setHeader(k: string, v: unknown) { this.headers[k] = v; },
    status(c: number) { this.statusCode = c; return this; },
    json() { return this; },
  };
  let passed = false;
  limiter(req, res as any, () => { passed = true; });
  return { passed, res };
}

describe('createRateLimiter', () => {
  it('allows up to max requests then answers 429 with Retry-After', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    for (let i = 0; i < 3; i++) expect(run(limiter, '1.1.1.1').passed).toBe(true);
    const blocked = run(limiter, '1.1.1.1');
    expect(blocked.passed).toBe(false);
    expect(blocked.res.statusCode).toBe(429);
    expect(blocked.res.headers['Retry-After']).toBeGreaterThan(0);
  });

  it('counts clients independently', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    expect(run(limiter, '1.1.1.1').passed).toBe(true);
    expect(run(limiter, '2.2.2.2').passed).toBe(true);
    expect(run(limiter, '1.1.1.1').passed).toBe(false);
  });

  it('ip-route mode limits per path; ip mode limits across paths', () => {
    const perRoute = createRateLimiter({ windowMs: 60_000, max: 1 });
    expect(run(perRoute, '3.3.3.3', '/a').passed).toBe(true);
    expect(run(perRoute, '3.3.3.3', '/b').passed).toBe(true);

    const perIp = createRateLimiter({ windowMs: 60_000, max: 1, keyBy: 'ip' });
    expect(run(perIp, '4.4.4.4', '/a').passed).toBe(true);
    expect(run(perIp, '4.4.4.4', '/b').passed).toBe(false);
  });

  it('keeps separate counters per limiter so stacked limiters do not double-count', () => {
    const strict = createRateLimiter({ windowMs: 60_000, max: 2 });
    const general = createRateLimiter({ windowMs: 60_000, max: 2 });
    for (let i = 0; i < 2; i++) {
      expect(run(general, '5.5.5.5').passed).toBe(true);
      expect(run(strict, '5.5.5.5').passed).toBe(true);
    }
  });
});
