import Joi from 'joi';

export const listNotificationsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  isRead: Joi.boolean().optional(),
  type: Joi.string().valid('ORDER_UPDATE', 'KHATA_REMINDER', 'OFFER', 'SYSTEM').optional(),
});

export const notificationPreferencesSchema = Joi.object({
  email: Joi.boolean().optional(),
  sms: Joi.boolean().optional(),
  push: Joi.boolean().optional(),
  whatsapp: Joi.boolean().optional(),
  orderUpdates: Joi.boolean().optional(),
  khataReminders: Joi.boolean().optional(),
  offers: Joi.boolean().optional(),
  systemAlerts: Joi.boolean().optional(),
}).min(1);

export const createReviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().max(2000).optional().allow(''),
  photoUrls: Joi.array().items(Joi.string().uri()).max(5).optional(),
});

export const updateReviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).optional(),
  comment: Joi.string().max(2000).optional().allow(''),
  photoUrls: Joi.array().items(Joi.string().uri()).max(5).optional(),
}).min(1);

export const listReviewsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  rating: Joi.number().integer().min(1).max(5).optional(),
});

export const createTicketSchema = Joi.object({
  title: Joi.string().max(200).required(),
  description: Joi.string().max(5000).required(),
  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').default('MEDIUM'),
  category: Joi.string().valid('ORDER', 'PAYMENT', 'KHATA', 'PRODUCT', 'OTHER').optional(),
  referenceId: Joi.string().max(100).optional(),
});

export const updateTicketSchema = Joi.object({
  title: Joi.string().max(200).optional(),
  description: Joi.string().max(5000).optional(),
  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').optional(),
  status: Joi.string().valid('OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED').optional(),
  category: Joi.string().valid('ORDER', 'PAYMENT', 'KHATA', 'PRODUCT', 'OTHER').optional(),
  remarks: Joi.string().max(1000).optional(),
}).min(1);

export const addTicketMessageSchema = Joi.object({
  message: Joi.string().max(5000).required(),
  isInternal: Joi.boolean().default(false),
});

export const listTicketsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED').optional(),
  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').optional(),
  category: Joi.string().valid('ORDER', 'PAYMENT', 'KHATA', 'PRODUCT', 'OTHER').optional(),
});

export const listTicketsAdminQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED').optional(),
  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').optional(),
  category: Joi.string().valid('ORDER', 'PAYMENT', 'KHATA', 'PRODUCT', 'OTHER').optional(),
  userId: Joi.string().uuid().optional(),
});
