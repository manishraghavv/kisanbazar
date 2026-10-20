import Joi from 'joi';

export const registerSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).required(),
  phoneNumber: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required()
    .messages({ 'string.pattern.base': 'Enter a valid 10-digit Indian mobile number' }),
  email: Joi.string().email().optional(),
  password: Joi.string().min(6).required(),
  // ADMIN and DELIVERY accounts are provisioned by admins, never self-registered.
  role: Joi.string().valid('FARMER', 'VENDOR').required(),
  referralCode: Joi.string().optional(),
  languagePref: Joi.string().valid('hi', 'en', 'mr', 'pa', 'ta').default('hi'),
  deviceType: Joi.string().valid('android', 'ios', 'web').optional(),
});

export const loginSchema = Joi.object({
  phoneNumber: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required(),
  password: Joi.string().required(),
});

export const verifyOtpSchema = Joi.object({
  phoneNumber: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required(),
  otp: Joi.string().length(6).required(),
});

export const resendOtpSchema = Joi.object({
  phoneNumber: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required(),
});

export const forgotPasswordSchema = Joi.object({
  phoneNumber: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required(),
});

export const resetPasswordSchema = Joi.object({
  phoneNumber: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required(),
  otp: Joi.string().length(6).required(),
  newPassword: Joi.string().min(6).required(),
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});
