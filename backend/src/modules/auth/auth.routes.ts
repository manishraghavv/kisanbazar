import { Router, Request, Response, NextFunction } from 'express';
import {
  register,
  login,
  logout,
  refreshAccessToken,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
} from './auth.controller';
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
} from './auth.validator';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import Joi from 'joi';

const router = Router();

function validate(schema: Joi.ObjectSchema) {
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

router.post('/register', validate(registerSchema), asyncHandler(register));
router.post('/login', validate(loginSchema), asyncHandler(login));
router.post('/logout', asyncHandler(logout));
router.post('/refresh-token', validate(refreshTokenSchema), asyncHandler(refreshAccessToken));
router.post('/verify-otp', validate(verifyOtpSchema), asyncHandler(verifyOtp));
router.post('/resend-otp', validate(resendOtpSchema), asyncHandler(resendOtp));
router.post('/forgot-password', validate(forgotPasswordSchema), asyncHandler(forgotPassword));
router.post('/reset-password', validate(resetPasswordSchema), asyncHandler(resetPassword));

export default router;
