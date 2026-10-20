import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: { user: { findUnique: vi.fn() }, session: { deleteMany: vi.fn() } },
  cache: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
}));
vi.mock('./prisma', () => ({ prisma: mocks.prisma }));
vi.mock('./cache', () => ({ cache: mocks.cache }));

import { getUserAuthStatus, isAccessAllowed, revokeUserAccess, AUTH_STATE_TTL_SECONDS } from './userAuthState';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cache.get.mockResolvedValue(undefined);
});

describe('getUserAuthStatus', () => {
  it('reads from the DB on a miss and caches briefly', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ status: 'ACTIVE', deletedAt: null });
    expect(await getUserAuthStatus('u1')).toBe('ACTIVE');
    expect(mocks.cache.set).toHaveBeenCalledWith('auth:user-status:u1', 'ACTIVE', AUTH_STATE_TTL_SECONDS);
  });

  it('serves from cache without touching the DB', async () => {
    mocks.cache.get.mockResolvedValue('BLOCKED');
    expect(await getUserAuthStatus('u1')).toBe('BLOCKED');
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('treats soft-deleted users as DELETED and unknown users as null (not cached)', async () => {
    mocks.prisma.user.findUnique.mockResolvedValueOnce({ status: 'ACTIVE', deletedAt: new Date() });
    expect(await getUserAuthStatus('u1')).toBe('DELETED');
    mocks.prisma.user.findUnique.mockResolvedValueOnce(null);
    expect(await getUserAuthStatus('ghost')).toBeNull();
    expect(mocks.cache.set).toHaveBeenCalledTimes(1);
  });
});

describe('isAccessAllowed', () => {
  it('rejects BLOCKED, DELETED and null only', () => {
    expect(isAccessAllowed('ACTIVE')).toBe(true);
    expect(isAccessAllowed('INACTIVE')).toBe(true);
    expect(isAccessAllowed('BLOCKED')).toBe(false);
    expect(isAccessAllowed('DELETED')).toBe(false);
    expect(isAccessAllowed(null)).toBe(false);
  });
});

describe('revokeUserAccess', () => {
  it('clears the cache entry and refresh sessions for BLOCKED/DELETED', async () => {
    await revokeUserAccess('u1', 'BLOCKED');
    expect(mocks.cache.del).toHaveBeenCalledWith('auth:user-status:u1');
    expect(mocks.prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });
  it('only clears the cache for other statuses', async () => {
    await revokeUserAccess('u1', 'ACTIVE');
    expect(mocks.cache.del).toHaveBeenCalled();
    expect(mocks.prisma.session.deleteMany).not.toHaveBeenCalled();
  });
});
