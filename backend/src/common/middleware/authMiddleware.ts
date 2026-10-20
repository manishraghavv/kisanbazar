import { Request, Response, NextFunction } from 'express';
import { verifyToken, getAccessSecret } from '../utils/jwtUtils';
import { UserRole } from '@prisma/client';
import { getUserAuthStatus, isAccessAllowed } from '../lib/userAuthState';
import { AuthRequest } from '../types/express.d';

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Access token required' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token, getAccessSecret());

  if (!payload) {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
    return;
  }

  // A valid JWT is not enough: BLOCKED / DELETED / unknown accounts lose access immediately.
  let status;
  try {
    status = await getUserAuthStatus(payload.userId);
  } catch (err) {
    console.error('[AUTH] Account status lookup failed; denying request', (err as Error).message);
    res.status(503).json({ success: false, message: 'Authentication temporarily unavailable' });
    return;
  }
  if (!isAccessAllowed(status)) {
    res.status(401).json({ success: false, message: 'Account is not active' });
    return;
  }

  (req as AuthRequest).user = { id: payload.userId, role: payload.role as UserRole };
  next();
};

export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthRequest).user;

    if (!user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    next();
  };
};
