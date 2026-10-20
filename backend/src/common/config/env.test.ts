import { describe, it, expect } from 'vitest';
import { validateEnv, durationToSeconds, EnvValidationError } from './env';

const ACCESS = 'a'.repeat(8) + 'Kx9$mQ2vLp7#zT4wRb6&nY1cHd5@jF3s';
const REFRESH = 'Zq8!rW5eT2yU7iO1pA4sD6fG9hJ3kL0xCvBnMzXcVb';

const base = (over: Record<string, string | undefined> = {}) =>
  ({ DATABASE_URL: 'postgresql://u:p@localhost:5432/db', JWT_ACCESS_SECRET: ACCESS, JWT_REFRESH_SECRET: REFRESH, ...over }) as NodeJS.ProcessEnv;

const prod = (over: Record<string, string | undefined> = {}) =>
  base({ NODE_ENV: 'production', CORS_ORIGIN: 'https://shop.example.in', RAZORPAY_WEBHOOK_SECRET: 'whsec_0123456789abcdef', ...over });

const problems = (env: NodeJS.ProcessEnv) => {
  try {
    validateEnv(env);
    return [];
  } catch (e) {
    expect(e).toBeInstanceOf(EnvValidationError);
    return (e as EnvValidationError).problems;
  }
};

describe('validateEnv — JWT secrets', () => {
  it('accepts strong, distinct secrets and applies defaults', () => {
    const v = validateEnv(base()) as Record<string, unknown>;
    expect(v.JWT_ACCESS_EXPIRES_IN).toBe('15m');
    expect(v.NODE_ENV).toBe('development');
  });

  it('fails when a secret is missing', () => {
    expect(problems(base({ JWT_ACCESS_SECRET: undefined })).join()).toMatch(/JWT_ACCESS_SECRET/);
    expect(problems(base({ JWT_REFRESH_SECRET: undefined })).join()).toMatch(/JWT_REFRESH_SECRET/);
  });

  it('rejects the old hardcoded fallbacks and placeholders', () => {
    expect(problems(base({ JWT_ACCESS_SECRET: 'access_secret' })).length).toBeGreaterThan(0);
    expect(problems(base({ JWT_REFRESH_SECRET: 'refresh_secret' })).length).toBeGreaterThan(0);
    expect(problems(base({ JWT_ACCESS_SECRET: 'your-access-secret-change-this-in-production' })).join()).toMatch(/weak/);
  });

  it('rejects short and low-entropy secrets', () => {
    expect(problems(base({ JWT_ACCESS_SECRET: 'Sh0rt!secret' })).join()).toMatch(/at least 32/);
    expect(problems(base({ JWT_ACCESS_SECRET: 'a'.repeat(48) })).join()).toMatch(/weak/);
  });

  it('rejects identical access and refresh secrets', () => {
    expect(problems(base({ JWT_REFRESH_SECRET: ACCESS })).join()).toMatch(/must differ/);
  });
});

describe('validateEnv — access token TTL', () => {
  it.each(['15m', '900s', '900', '5m'])('accepts %s', (ttl) => {
    expect(problems(base({ JWT_ACCESS_EXPIRES_IN: ttl }))).toEqual([]);
  });
  it.each(['16m', '1h', '1d', 'forever', '0m'])('rejects %s', (ttl) => {
    expect(problems(base({ JWT_ACCESS_EXPIRES_IN: ttl })).join()).toMatch(/15 minutes/);
  });
  it('parses durations', () => {
    expect(durationToSeconds('15m')).toBe(900);
    expect(durationToSeconds('7d')).toBe(604800);
    expect(durationToSeconds('x')).toBeNaN();
  });
});

describe('validateEnv — production hardening', () => {
  it('accepts a complete production config', () => {
    expect(problems(prod())).toEqual([]);
  });
  it('requires CORS_ORIGIN and rejects "*" in production', () => {
    expect(problems(prod({ CORS_ORIGIN: undefined })).join()).toMatch(/CORS_ORIGIN/);
    expect(problems(prod({ CORS_ORIGIN: '*' })).join()).toMatch(/no "\*"/);
    expect(problems(prod({ CORS_ORIGIN: 'https://a.in, *' })).join()).toMatch(/no "\*"/);
  });
  it('requires RAZORPAY_WEBHOOK_SECRET in production only', () => {
    expect(problems(prod({ RAZORPAY_WEBHOOK_SECRET: undefined })).join()).toMatch(/RAZORPAY_WEBHOOK_SECRET/);
    expect(problems(base())).toEqual([]);
  });
  it('requires DATABASE_URL', () => {
    expect(problems(base({ DATABASE_URL: undefined })).join()).toMatch(/DATABASE_URL/);
  });
});
