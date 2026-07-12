import Joi from 'joi';

export const createAddressSchema = Joi.object({
  label: Joi.string().max(50).optional(),
  addressLine1: Joi.string().min(3).max(200).required(),
  addressLine2: Joi.string().max(200).optional(),
  village: Joi.string().max(100).optional(),
  city: Joi.string().min(2).max(100).required(),
  district: Joi.string().max(100).optional(),
  state: Joi.string().min(2).max(100).required(),
  pincode: Joi.string().length(6).pattern(/^\d{6}$/).required(),
  isDefault: Joi.boolean().optional(),
});

export const updateAddressSchema = Joi.object({
  label: Joi.string().max(50).optional(),
  addressLine1: Joi.string().min(3).max(200).optional(),
  addressLine2: Joi.string().max(200).optional(),
  village: Joi.string().max(100).optional(),
  city: Joi.string().min(2).max(100).optional(),
  district: Joi.string().max(100).optional(),
  state: Joi.string().min(2).max(100).optional(),
  pincode: Joi.string().length(6).pattern(/^\d{6}$/).optional(),
  isDefault: Joi.boolean().optional(),
}).min(1);

export const addressQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
