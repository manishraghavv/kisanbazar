import { Request } from 'express';
import { UserRole } from '@prisma/client';

export interface AuthRequest extends Request {
  user: {
    id: string;
    role: UserRole;
  };
}
