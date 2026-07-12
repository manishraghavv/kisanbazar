import Joi from 'joi';

export const createIndustrySchema = Joi.object({
  name: Joi.string().max(200).required(),
  slug: Joi.string()
    .pattern(/^[a-z0-9-]+$/)
    .max(200)
    .required(),
  description: Joi.string().max(1000).optional().allow(''),
  isActive: Joi.boolean().default(true),
});

export const updateIndustrySchema = Joi.object({
  name: Joi.string().max(200).optional(),
  slug: Joi.string()
    .pattern(/^[a-z0-9-]+$/)
    .max(200)
    .optional(),
  description: Joi.string().max(1000).optional().allow(''),
  isActive: Joi.boolean().optional(),
}).min(1);

export const listIndustriesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  isActive: Joi.boolean().optional(),
});

export const createTierSchema = Joi.object({
  name: Joi.string().max(200).required(),
  size: Joi.string()
    .valid('MICRO', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE')
    .required(),
  minAnnualRevenue: Joi.number().min(0).optional(),
  maxAnnualRevenue: Joi.number().min(0).optional(),
  defaultCommissionRate: Joi.number().min(0).max(100).optional(),
  maxKhataLimit: Joi.number().min(0).optional(),
  description: Joi.string().max(1000).optional().allow(''),
});

export const updateTierSchema = Joi.object({
  name: Joi.string().max(200).optional(),
  size: Joi.string()
    .valid('MICRO', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE')
    .optional(),
  minAnnualRevenue: Joi.number().min(0).optional().allow(null),
  maxAnnualRevenue: Joi.number().min(0).optional().allow(null),
  defaultCommissionRate: Joi.number().min(0).max(100).optional().allow(null),
  maxKhataLimit: Joi.number().min(0).optional().allow(null),
  description: Joi.string().max(1000).optional().allow(''),
}).min(1);

export const assignVendorTierSchema = Joi.object({
  industryId: Joi.string().uuid().optional().allow(null),
  enterpriseTierId: Joi.string().uuid().optional().allow(null),
});

export const listAuditLogsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  entityType: Joi.string().max(100).optional(),
  entityId: Joi.string().uuid().optional(),
  action: Joi.string().max(100).optional(),
  actorId: Joi.string().uuid().optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
});

export const vendorAnalyticsQuerySchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  period: Joi.string().valid('daily', 'weekly', 'monthly', 'yearly').default('monthly'),
});

export const adminDashboardQuerySchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
});

export const productPerformanceQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  categoryId: Joi.string().uuid().optional(),
  vendorId: Joi.string().uuid().optional(),
});

export const khataOverdueQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  minOverdueDays: Joi.number().integer().min(0).default(1),
});

export const dataExportSchema = Joi.object({
  types: Joi.array()
    .items(Joi.string().valid('profile', 'orders', 'khata', 'reviews', 'wallet'))
    .min(1)
    .required(),
});
