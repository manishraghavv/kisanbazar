import Joi from 'joi';

export const createKhataAccountSchema = Joi.object({
  farmerId: Joi.string().uuid().required(),
  creditLimitAmount: Joi.number().positive().required(),
  interestRatePct: Joi.number().min(0).max(100).default(0),
  creditPeriodDays: Joi.number().integer().min(1).max(365).default(30),
});

export const updateKhataAccountSchema = Joi.object({
  creditLimitAmount: Joi.number().positive(),
  interestRatePct: Joi.number().min(0).max(100),
  creditPeriodDays: Joi.number().integer().min(1).max(365),
  status: Joi.string().valid('ACTIVE', 'SETTLED', 'OVERDUE', 'SUSPENDED', 'WRITTEN_OFF'),
}).min(1);

export const addTransactionSchema = Joi.object({
  type: Joi.string()
    .valid('UDHAR_DIYA', 'WAPSI_MILI', 'INTEREST_LAGA', 'WAIVER', 'ORDER_LINKED')
    .required(),
  amount: Joi.number().positive().required(),
  linkedOrderId: Joi.string().uuid().optional(),
  remarks: Joi.string().max(500).optional(),
  proofImageUrl: Joi.string().uri().optional(),
  upiTransactionId: Joi.string().max(100).optional(),
});

export const createKhataRequestSchema = Joi.object({
  requestedLimit: Joi.number().positive().required(),
  reason: Joi.string().max(500).optional(),
});

export const reviewKhataRequestSchema = Joi.object({
  status: Joi.string().valid('APPROVED', 'REJECTED').required(),
  reviewNote: Joi.string().max(500).optional(),
});

export const getAccountsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('ACTIVE', 'SETTLED', 'OVERDUE', 'SUSPENDED', 'WRITTEN_OFF').optional(),
  farmerId: Joi.string().uuid().optional(),
  vendorId: Joi.string().uuid().optional(),
});

export const getTransactionsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  type: Joi.string()
    .valid('UDHAR_DIYA', 'WAPSI_MILI', 'INTEREST_LAGA', 'WAIVER', 'ORDER_LINKED')
    .optional(),
});

export const generateStatementSchema = Joi.object({
  periodStart: Joi.date().iso().required(),
  periodEnd: Joi.date().iso().greater(Joi.ref('periodStart')).required(),
});

export const getOverdueAccountsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  farmerId: Joi.string().uuid().optional(),
  minDaysOverdue: Joi.number().integer().min(1).default(1),
});
