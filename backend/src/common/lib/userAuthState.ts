import { prisma } from './prisma';
import { cache } from './cache';

/**
 * Account state used by authenticate() so that blocking/deleting a user takes effect
 * immediately instead of when their access token expires. Lookups are cached briefly
 * (Redis when available, so invalidation reaches every instance); status changes
 * call revokeUserAccess() to drop the entry and kill refresh sessions.
 */

export const AUTH_STATE_TTL_SECONDS = 30;
const BLOCKED_STATUSES = ['BLOCKED', 'DELETED'];
const key = (userId: string) => `auth:user-status:${userId}`;

export type AuthUserStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'DELETED';

/** Returns the account status, or null when the user does not exist (or is soft-deleted). */
export async function getUserAuthStatus(userId: string): Promise<AuthUserStatus | null> {
  const cached = await cache.get(key(userId));
  if (typeof cached === 'string') return cached as AuthUserStatus;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true, deletedAt: true } });
  if (!user) return null;

  const status: AuthUserStatus = user.deletedAt ? 'DELETED' : (user.status as AuthUserStatus);
  await cache.set(key(userId), status, AUTH_STATE_TTL_SECONDS);
  return status;
}

export const isAccessAllowed = (status: AuthUserStatus | null): boolean =>
  status !== null && !BLOCKED_STATUSES.includes(status);

/** Call after any status/role/deletion change. */
export async function invalidateUserAuthState(userId: string): Promise<void> {
  await cache.del(key(userId));
}

/** Drops the cache entry and, for BLOCKED/DELETED users, every refresh session. */
export async function revokeUserAccess(userId: string, status?: string): Promise<void> {
  await invalidateUserAuthState(userId);
  if (status && BLOCKED_STATUSES.includes(status)) {
    await prisma.session.deleteMany({ where: { userId } });
  }
}
