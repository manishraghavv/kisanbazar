import { describe, it, expect } from 'vitest';
import { getAllowedOrigins, corsOriginCheck } from './cors';

const check = (allowed: string[], origin?: string) => {
  let result: boolean | undefined;
  corsOriginCheck(allowed)(origin, (_err, allow) => { result = allow; });
  return result;
};

describe('getAllowedOrigins', () => {
  it('parses a comma-separated list, trimming spaces and trailing slashes', () => {
    expect(getAllowedOrigins({ CORS_ORIGIN: 'https://a.in/, https://b.in' } as NodeJS.ProcessEnv)).toEqual(['https://a.in', 'https://b.in']);
  });
  it('never yields a wildcard', () => {
    expect(getAllowedOrigins({ CORS_ORIGIN: '*', NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toEqual([]);
  });
  it('fails closed in production when unset', () => {
    expect(getAllowedOrigins({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toEqual([]);
  });
  it('defaults to local frontends outside production', () => {
    expect(getAllowedOrigins({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toContain('http://localhost:3000');
  });
});

describe('corsOriginCheck', () => {
  it('allows listed origins, blocks others, allows origin-less requests', () => {
    expect(check(['https://a.in'], 'https://a.in')).toBe(true);
    expect(check(['https://a.in'], 'https://evil.com')).toBe(false);
    expect(check([], 'https://a.in')).toBe(false);
    expect(check([], undefined)).toBe(true);
  });
});
