import { Request, Response } from 'express';
import { container } from '../../common/lib/di';
import { UserService } from './user.service';
const userService = container.resolve(UserService);
import { AuthRequest } from '../../common/types/express.d';

function handleServiceError(err: unknown, res: Response): void {
  const e = err as { status?: number; statusCode?: number; message?: string };
  res.status(e.statusCode ?? e.status ?? 500).json({ success: false, message: e.message ?? 'Internal server error' });
}

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await userService.getById(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const updateMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await userService.updateProfile(req.user.id, req.body);
    res.json({ success: true, message: 'Profile updated', data });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await userService.getById(req.params.id as string);
    res.json({ success: true, data });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const updateUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await userService.adminUpdate(req.params.id as string, req.body);
    res.json({ success: true, message: 'User updated', data });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const deleteUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    await userService.softDelete(req.params.id as string);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const listUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const role = typeof req.query.role === 'string' ? req.query.role : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;

    const result = await userService.list({ page, limit, role, status, search });
    res.json({
      success: true,
      data: result.users,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const updateFarmerProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await userService.updateFarmerProfile(req.user.id, req.body);
    res.json({ success: true, message: 'Farmer profile updated', data });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const updateVendorProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await userService.updateVendorProfile(req.user.id, req.body);
    res.json({ success: true, message: 'Vendor profile updated', data });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const changeMyPhone = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await userService.changePhone(req.user.id, req.body.newPhone, req.body.password);
    res.json({ success: true, ...result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const deleteMyAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await userService.selfDelete(req.user.id, req.body.password);
    res.json({ success: true, ...result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const updateUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await userService.adminUpdateStatus(req.params.id as string, req.body.status);
    res.json({ success: true, message: `User status updated to ${req.body.status}`, data });
  } catch (err) {
    handleServiceError(err, res);
  }
};
