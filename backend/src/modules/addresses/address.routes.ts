import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../common/middleware/authMiddleware';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AuthRequest } from '../../common/types/express.d';
import {
  createAddress,
  listAddresses,
  getAddressById,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from './address.controller';
import { createAddressSchema, updateAddressSchema, addressQuerySchema } from './address.validator';

const router = Router();

function validateBody(schema: ReturnType<typeof import('joi').object>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map((d) => ({ field: d.path.join('.'), message: d.message })),
      });
      return;
    }
    req.body = value;
    next();
  };
}

function validateQuery(schema: ReturnType<typeof import('joi').object>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, { abortEarly: false, stripUnknown: true });
    if (error) {
      res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map((d) => ({ field: d.path.join('.'), message: d.message })),
      });
      return;
    }
    Object.assign(req.query, value);
    next();
  };
}

// All address routes require authentication
router.use(authenticate);

router.post(
  '/',
  validateBody(createAddressSchema),
  asyncHandler((req, res) => createAddress(req as AuthRequest, res)),
);
router.get(
  '/',
  validateQuery(addressQuerySchema),
  asyncHandler((req, res) => listAddresses(req as AuthRequest, res)),
);
router.get(
  '/:id',
  asyncHandler((req, res) => getAddressById(req as AuthRequest, res)),
);
router.put(
  '/:id',
  validateBody(updateAddressSchema),
  asyncHandler((req, res) => updateAddress(req as AuthRequest, res)),
);
router.delete(
  '/:id',
  asyncHandler((req, res) => deleteAddress(req as AuthRequest, res)),
);
router.put(
  '/:id/default',
  asyncHandler((req, res) => setDefaultAddress(req as AuthRequest, res)),
);

export default router;
