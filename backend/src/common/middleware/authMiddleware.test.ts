import jwt from 'jsonwebtoken';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Plain function (not vi.fn): Vitest's spy wrapper reports rejecting mocks as unhandled rejections.
const state = vi.hoisted(() => ({
  calls: 0,
  impl: async (): Promise<string | null> => 'ACTIVE',
}));
vi.mock('../lib/userAuthState', async () => {
  const actual = await vi.importActual<typeof import('../lib/userAuthState')>('../lib/userAuthState');
  return { ...actual, getUserAuthStatus: () => { state.calls++; return state.impl(); } };
});
vi.mock('../lib/prisma', () => ({ prisma: {} }));
vi.mock('../lib/cache', () => ({ cache: {} }));

import { authenticate } from './authMiddleware';

const SECRET = 'Zq8!rW5eT2yU7iO1pA4sD6fG9hJ3kL0xCvBnMzXcVb';
process.env.JWT_ACCESS_SECRET = SECRET;

const token = (userId = 'u1', role = 'FARMER', secret = SECRET, opts: jwt.SignOptions = { expiresIn: '5m' }) =>
  jwt.sign({ userId, role }, secret, opts);

async function run(authorization?: string) {
  const req = { headers: { authorization } } as any;
  const res = { statusCode: 200, body: undefined as any, status(c: number) { this.statusCode = c; return this; }, json(b: unknown) { this.body = b; return this; } };
  const next = vi.fn();
  await authenticate(req, res as any, next);
  return { req, res, next };
}

beforeEach(() => { state.calls = 0; state.impl = async () => 'ACTIVE'; });

describe('authenticate', () => {
  it('accepts a valid token for an ACTIVE user and sets req.user', async () => {
    const { req, next } = await run(`Bearer ${token()}`);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual({ id: 'u1', role: 'FARMER' });
  });

  it('allows INACTIVE accounts (only BLOCKED/DELETED are rejected)', async () => {
    state.impl = async () => 'INACTIVE';
    expect((await run(`Bearer ${token()}`)).next).toHaveBeenCalledOnce();
  });

  it.each(['BLOCKED', 'DELETED'])('rejects a valid token when the user is %s', async (status) => {
    state.impl = async () => status;
    const { res, next } = await run(`Bearer ${token()}`);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a valid token for a user that no longer exists', async () => {
    state.impl = async () => null;
    expect((await run(`Bearer ${token()}`)).res.statusCode).toBe(401);
  });

  it('fails closed with 503 when the status lookup errors', async () => {
    state.impl = async () => { throw new Error('db down'); };
    const { res, next } = await run(`Bearer ${token()}`);
    expect(res.statusCode).toBe(503);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects missing, malformed, wrong-secret and expired tokens without a DB lookup', async () => {
    expect((await run()).res.statusCode).toBe(401);
    expect((await run('Bearer garbage')).res.statusCode).toBe(401);
    expect((await run(`Bearer ${token('u1', 'FARMER', 'another-secret-that-is-long-enough-123456')}`)).res.statusCode).toBe(401);
    expect((await run(`Bearer ${token('u1', 'FARMER', SECRET, { expiresIn: -10 })}`)).res.statusCode).toBe(401);
    expect(state.calls).toBe(0);
  });
});
