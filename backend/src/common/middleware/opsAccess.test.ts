import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const auth = vi.hoisted(() => ({
  authenticate: vi.fn(),
  authorize: vi.fn(),
}));
vi.mock('./authMiddleware', () => auth);

import { requireMetricsAccess, apiDocsGate, isBullBoardEnabled } from './opsAccess';

const ORIGINAL = { ...process.env };
afterEach(() => { process.env = { ...ORIGINAL }; });

function res() {
  return { statusCode: 200, body: undefined as any, status(c: number) { this.statusCode = c; return this; }, json(b: unknown) { this.body = b; return this; } };
}
const req = (authorization?: string) => ({ headers: { authorization }, method: 'GET', path: '/x' }) as any;

beforeEach(() => {
  auth.authenticate.mockReset().mockImplementation((_r, resp, next) => { resp.status(401).json({}); });
  auth.authorize.mockReset().mockImplementation(() => (_r: unknown, _s: unknown, next: () => void) => next());
});

describe('requireMetricsAccess', () => {
  it('is open outside production', () => {
    process.env.NODE_ENV = 'development';
    const next = vi.fn();
    requireMetricsAccess(req(), res() as any, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects anonymous requests in production', () => {
    process.env.NODE_ENV = 'production';
    const r = res();
    const next = vi.fn();
    requireMetricsAccess(req(), r as any, next);
    expect(r.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts the scraper bearer token in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.METRICS_TOKEN = 'scrape-token-123';
    const next = vi.fn();
    requireMetricsAccess(req('Bearer scrape-token-123'), res() as any, next);
    expect(next).toHaveBeenCalledOnce();
    expect(auth.authenticate).not.toHaveBeenCalled();
  });

  it('falls back to ADMIN auth when the token does not match', () => {
    process.env.NODE_ENV = 'production';
    process.env.METRICS_TOKEN = 'scrape-token-123';
    const r = res();
    requireMetricsAccess(req('Bearer wrong-token'), r as any, vi.fn());
    expect(auth.authenticate).toHaveBeenCalledOnce();
    expect(r.statusCode).toBe(401);
  });

  it('lets an authenticated ADMIN through in production', () => {
    process.env.NODE_ENV = 'production';
    auth.authenticate.mockImplementation((_r, _s, next) => next());
    const next = vi.fn();
    requireMetricsAccess(req('Bearer some.jwt'), res() as any, next);
    expect(auth.authorize).toHaveBeenCalledWith('ADMIN');
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('apiDocsGate', () => {
  it('serves docs in development', () => {
    process.env.NODE_ENV = 'development';
    const next = vi.fn();
    apiDocsGate(req(), res() as any, next);
    expect(next).toHaveBeenCalledOnce();
  });
  it('404s in production unless explicitly enabled', () => {
    process.env.NODE_ENV = 'production';
    const r = res();
    const next = vi.fn();
    apiDocsGate(req(), r as any, next);
    expect(r.statusCode).toBe(404);
    expect(next).not.toHaveBeenCalled();

    process.env.ENABLE_API_DOCS = 'true';
    apiDocsGate(req(), res() as any, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('isBullBoardEnabled', () => {
  it('is disabled in production unless ENABLE_BULL_BOARD=true', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ENABLE_BULL_BOARD;
    expect(isBullBoardEnabled()).toBe(false);
    process.env.ENABLE_BULL_BOARD = 'true';
    expect(isBullBoardEnabled()).toBe(true);
  });
  it('is enabled outside production', () => {
    process.env.NODE_ENV = 'development';
    expect(isBullBoardEnabled()).toBe(true);
  });
});
