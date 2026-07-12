import Joi from 'joi';

export const addCartItemSchema = Joi.object({
  variantId: Joi.string().uuid().required(),
  quantity: Joi.number().integer().min(1).max(99).required(),
});

export const updateCartItemSchema = Joi.object({
  quantity: Joi.number().integer().min(1).max(99).required(),
});

export const mergeCartSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        variantId: Joi.string().uuid().required(),
        quantity: Joi.number().integer().min(1).max(99).required(),
      }),
    )
    .min(1)
    .required(),
});

export const addWishlistItemSchema = Joi.object({
  productId: Joi.string().uuid().required(),
});

export const createOrderSchema = Joi.object({
  addressId: Joi.string().uuid().required(),
  paymentMethod: Joi.string()
    .valid('UPI', 'CARD', 'NET_BANKING', 'COD', 'WALLET', 'KHATA_CREDIT')
    .required(),
  khataAccountId: Joi.string().uuid().when('paymentMethod', {
    is: 'KHATA_CREDIT',
    then: Joi.required(),
    otherwise: Joi.optional().allow(null),
  }),
  couponCode: Joi.string().optional().allow(''),
  deliveryCharge: Joi.number().min(0).default(0),
  channel: Joi.string().valid('web', 'android', 'ios').optional(),
  notes: Joi.string().max(500).optional(),
});

export const cancelOrderSchema = Joi.object({
  reason: Joi.string().max(500).required(),
});

export const returnOrderSchema = Joi.object({
  reason: Joi.string().max(500).required(),
  photoUrls: Joi.array().items(Joi.string().uri()).max(5).optional(),
});

export const getOrdersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string()
    .valid('PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED')
    .optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
});

export const createShipmentSchema = Joi.object({
  logisticsPartner: Joi.string().max(100).optional(),
  awbNumber: Joi.string().max(100).optional(),
  pickupEta: Joi.date().iso().optional(),
  deliveryEta: Joi.date().iso().optional(),
});

export const updateShipmentSchema = Joi.object({
  logisticsPartner: Joi.string().max(100),
  awbNumber: Joi.string().max(100),
  pickupEta: Joi.date().iso(),
  deliveryEta: Joi.date().iso(),
  podImageUrl: Joi.string().uri(),
  currentStatus: Joi.string().max(100),
  deliveryAttempts: Joi.number().integer().min(0),
}).min(1);

export const addShipmentEventSchema = Joi.object({
  eventStatus: Joi.string().max(100).required(),
  location: Joi.string().max(200).optional(),
  geoLat: Joi.number().min(-90).max(90).optional(),
  geoLng: Joi.number().min(-180).max(180).optional(),
  source: Joi.string().valid('webhook', 'manual', 'driver_app').optional(),
});

export const createPaymentSchema = Joi.object({
  amount: Joi.number().positive().required(),
  paymentMethod: Joi.string()
    .valid('UPI', 'CARD', 'NET_BANKING', 'COD', 'WALLET', 'KHATA_CREDIT')
    .required(),
  gateway: Joi.string().valid('razorpay', 'payu', 'cod').optional(),
  transactionId: Joi.string().max(200).optional(),
  idempotencyKey: Joi.string().uuid().optional(),
  notes: Joi.string().max(500).optional(),
});

export const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid('CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED')
    .required(),
  remarks: Joi.string().max(500).optional(),
});
