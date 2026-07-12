import { Router, Request, Response, NextFunction } from 'express';
import {
  getMe,
  updateMe,
  getUserById,
  updateUserById,
  deleteUserById,
  listUsers,
  updateFarmerProfile,
  updateVendorProfile,
  changeMyPhone,
  deleteMyAccount,
  updateUserStatus,
} from './user.controller';
import { authenticate, authorize } from '../../common/middleware/authMiddleware';
import {
  updateProfileSchema,
  updateFarmerProfileSchema,
  updateVendorProfileSchema,
  adminUpdateUserSchema,
  changePhoneSchema,
  updateUserStatusSchema,
  deleteAccountSchema,
} from './user.validator';
import { AuthRequest } from '../../common/types/express.d';
import { asyncHandler } from '../../common/middleware/asyncHandler';

const router = Router();

function validate(schema: ReturnType<typeof import('joi').object>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map((d) => ({ field: d.path.join('.'), message: d.message })),
      });
      return;
    }
    next();
  };
}

// Current user
router.get('/me', authenticate, asyncHandler((req, res) => getMe(req as AuthRequest, res)));
router.put('/me', authenticate, validate(updateProfileSchema), asyncHandler((req, res) => updateMe(req as AuthRequest, res)));

// Self-service actions
router.put('/me/phone', authenticate, validate(changePhoneSchema), asyncHandler((req, res) => changeMyPhone(req as AuthRequest, res)));
router.delete('/me', authenticate, validate(deleteAccountSchema), asyncHandler((req, res) => deleteMyAccount(req as AuthRequest, res)));

// Role-specific profiles
router.put(
  '/me/farmer-profile',
  authenticate,
  authorize('FARMER'),
  validate(updateFarmerProfileSchema),
  asyncHandler((req, res) => updateFarmerProfile(req as AuthRequest, res)),
);
router.put(
  '/me/vendor-profile',
  authenticate,
  authorize('VENDOR'),
  validate(updateVendorProfileSchema),
  asyncHandler((req, res) => updateVendorProfile(req as AuthRequest, res)),
);

// Farmer search (for khata account creation — vendors can search)
router.get(
  '/farmers',
  authenticate,
  authorize('VENDOR', 'ADMIN'),
  asyncHandler((req, res) => listUsers(req as AuthRequest, res)),
);

// Admin-only
router.get('/', authenticate, authorize('ADMIN'), asyncHandler(listUsers));
router.get('/:id', authenticate, authorize('ADMIN'), asyncHandler(getUserById));
router.put('/:id', authenticate, authorize('ADMIN'), validate(adminUpdateUserSchema), asyncHandler(updateUserById));
router.put('/:id/status', authenticate, authorize('ADMIN'), validate(updateUserStatusSchema), asyncHandler((req, res) => updateUserStatus(req as AuthRequest, res)));
router.delete('/:id', authenticate, authorize('ADMIN'), asyncHandler(deleteUserById));

export default router;
