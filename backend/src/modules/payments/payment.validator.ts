import Joi from 'joi';

export const initiatePaymentSchema = Joi.object({
  orderId: Joi.string().uuid().required(),
  paymentMethod: Joi.string()
    .valid('UPI', 'CARD', 'NET_BANKING', 'COD', 'WALLET')
    .required(),
  gateway: Joi.string().valid('razorpay', 'payu', 'cod').optional(),
});

export const verifyPaymentSchema = Joi.object({
  paymentId: Joi.string().uuid().required(),
  transactionId: Joi.string().required(),
  gateway: Joi.string().valid('razorpay', 'payu', 'cod').required(),
});

export const processRefundSchema = Joi.object({
  paymentId: Joi.string().uuid().required(),
  amount: Joi.number().positive().max(9999999).optional(),
  reason: Joi.string().max(500).optional(),
});

export const listPaymentsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string()
    .valid('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED')
    .optional(),
  orderId: Joi.string().uuid().optional(),
});

export const addMoneySchema = Joi.object({
  amount: Joi.number().positive().min(1).max(100000).required(),
  remarks: Joi.string().max(200).optional(),
});

export const walletPaymentSchema = Joi.object({
  orderId: Joi.string().uuid().required(),
  amount: Joi.number().positive().required(),
});

export const walletTransactionsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  type: Joi.string().valid('CREDIT', 'DEBIT').optional(),
});

export const createCouponSchema = Joi.object({
  code: Joi.string()
    .pattern(/^[A-Z0-9_-]+$/)
    .max(50)
    .required()
    .messages({ 'string.pattern.base': 'Coupon code must be uppercase alphanumeric with _ and -' }),
  title: Joi.string().max(200).required(),
  type: Joi.string().valid('PERCENTAGE', 'FIXED', 'FREE_DELIVERY').required(),
  value: Joi.number().positive().required(),
  minimumAmount: Joi.number().min(0).optional(),
  maximumDiscount: Joi.number().positive().optional(),
  usageLimit: Joi.number().integer().min(1).optional(),
  perUserLimit: Joi.number().integer().min(1).default(1),
  applicableTo: Joi.string().valid('ALL', 'CATEGORY', 'VENDOR').default('ALL'),
  startsAt: Joi.date().iso().required(),
  expiresAt: Joi.date().iso().greater(Joi.ref('startsAt')).required(),
  isActive: Joi.boolean().default(true),
});

export const updateCouponSchema = Joi.object({
  title: Joi.string().max(200),
  type: Joi.string().valid('PERCENTAGE', 'FIXED', 'FREE_DELIVERY'),
  value: Joi.number().positive(),
  minimumAmount: Joi.number().min(0).allow(null),
  maximumDiscount: Joi.number().positive().allow(null),
  usageLimit: Joi.number().integer().min(1).allow(null),
  perUserLimit: Joi.number().integer().min(1),
  applicableTo: Joi.string().valid('ALL', 'CATEGORY', 'VENDOR'),
  startsAt: Joi.date().iso(),
  expiresAt: Joi.date().iso(),
  isActive: Joi.boolean(),
}).min(1);

export const listCouponsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  isActive: Joi.boolean().optional(),
  type: Joi.string().valid('PERCENTAGE', 'FIXED', 'FREE_DELIVERY').optional(),
});

export const validateCouponSchema = Joi.object({
  code: Joi.string().max(50).required(),
  subtotal: Joi.number().positive().required(),
  categoryId: Joi.string().uuid().optional(),
  vendorId: Joi.string().uuid().optional(),
});

export const autoApplyCouponSchema = Joi.object({
  subtotal: Joi.number().positive().required(),
  categoryId: Joi.string().uuid().optional(),
  vendorId: Joi.string().uuid().optional(),
});

export const bulkInvoiceSchema = Joi.object({
  orderIds: Joi.array().items(Joi.string().uuid()).min(1).max(50).required(),
});

export const generateSettlementSchema = Joi.object({
  vendorId: Joi.string().uuid().required(),
  periodStart: Joi.date().iso().required(),
  periodEnd: Joi.date().iso().greater(Joi.ref('periodStart')).required(),
});

export const paySettlementSchema = Joi.object({
  utrNumber: Joi.string().max(100).required(),
});

export const listSettlementsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('PENDING', 'PROCESSING', 'PAID', 'FAILED').optional(),
});

export const listCommissionsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  orderId: Joi.string().uuid().optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
});
