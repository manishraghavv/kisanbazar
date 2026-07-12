import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwtUtils';
import { UserRole } from '@prisma/client';
import { AuthRequest } from '../types/express.d';

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Access token required' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token, process.env.JWT_ACCESS_SECRET || 'access_secret');

  if (!payload) {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
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
