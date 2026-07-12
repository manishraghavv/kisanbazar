import Joi from 'joi';

export const updateProfileSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).optional(),
  email: Joi.string().email().optional(),
  languagePref: Joi.string().valid('hi', 'en', 'mr', 'pa', 'ta').optional(),
  deviceType: Joi.string().valid('android', 'ios', 'web').optional(),
});

export const updateFarmerProfileSchema = Joi.object({
  village: Joi.string().optional(),
  district: Joi.string().optional(),
  state: Joi.string().optional(),
  pincode: Joi.string().length(6).optional(),
  landAreaAcres: Joi.number().positive().optional(),
  primaryCrops: Joi.array().items(Joi.string()).optional(),
});

export const updateVendorProfileSchema = Joi.object({
  businessName: Joi.string().min(2).max(200).optional(),
  gstNumber: Joi.string()
    .pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .optional()
    .messages({ 'string.pattern.base': 'Enter a valid GST number' }),
  panNumber: Joi.string()
    .pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    .optional()
    .messages({ 'string.pattern.base': 'Enter a valid PAN number' }),
});

export const adminUpdateUserSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).optional(),
  email: Joi.string().email().optional(),
  status: Joi.string().valid('ACTIVE', 'INACTIVE', 'BLOCKED').optional(),
  role: Joi.string().valid('FARMER', 'VENDOR', 'ADMIN', 'DELIVERY').optional(),
});

export const changePhoneSchema = Joi.object({
  newPhone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required()
    .messages({ 'string.pattern.base': 'Enter a valid 10-digit Indian mobile number' }),
  password: Joi.string().min(6).required(),
});

export const updateUserStatusSchema = Joi.object({
  status: Joi.string().valid('ACTIVE', 'INACTIVE', 'BLOCKED').required(),
  reason: Joi.string().max(500).optional(),
});

export const deleteAccountSchema = Joi.object({
  password: Joi.string().min(6).required(),
});
