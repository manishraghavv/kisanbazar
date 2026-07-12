import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../common/middleware/authMiddleware';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AuthRequest } from '../../common/types/express.d';
import {
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  clearCart,
  mergeCart,
  getWishlist,
  addWishlistItem,
  removeWishlistItem,
  moveWishlistToCart,
  createOrder,
  getOrders,
  getOrderById,
  cancelOrder,
  returnOrder,
  getOrderStatusHistory,
  updateOrderStatus,
  createPayment,
  getPayments,
  createShipment,
  getShipments,
  updateShipment,
  addShipmentEvent,
  getShipmentEvents,
} from './order.controller';
import {
  addCartItemSchema,
  updateCartItemSchema,
  mergeCartSchema,
  addWishlistItemSchema,
  createOrderSchema,
  cancelOrderSchema,
  returnOrderSchema,
  getOrdersQuerySchema,
  createPaymentSchema,
  createShipmentSchema,
  updateShipmentSchema,
  addShipmentEventSchema,
  updateOrderStatusSchema,
} from './order.validator';

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

// All cart, wishlist, and order routes require authentication
router.use(authenticate);

// ═══════════════════════════════════════════════════════════════════════════════
//  CART  (Any authenticated user)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/cart', asyncHandler((req, res) => getCart(req as AuthRequest, res)));
router.post('/cart/items', validateBody(addCartItemSchema), asyncHandler((req, res) => addCartItem(req as AuthRequest, res)));
router.put('/cart/items/:itemId', validateBody(updateCartItemSchema), asyncHandler((req, res) => updateCartItem(req as AuthRequest, res)));
router.delete('/cart/items/:itemId', asyncHandler((req, res) => removeCartItem(req as AuthRequest, res)));
router.delete('/cart', asyncHandler((req, res) => clearCart(req as AuthRequest, res)));
router.post('/cart/merge', validateBody(mergeCartSchema), asyncHandler((req, res) => mergeCart(req as AuthRequest, res)));

// ═══════════════════════════════════════════════════════════════════════════════
//  WISHLIST  (Any authenticated user)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/wishlist', asyncHandler((req, res) => getWishlist(req as AuthRequest, res)));
router.post('/wishlist/items', validateBody(addWishlistItemSchema), asyncHandler((req, res) => addWishlistItem(req as AuthRequest, res)));
router.delete('/wishlist/items/:itemId', asyncHandler((req, res) => removeWishlistItem(req as AuthRequest, res)));
router.post('/wishlist/items/:itemId/move', asyncHandler((req, res) => moveWishlistToCart(req as AuthRequest, res)));

// ═══════════════════════════════════════════════════════════════════════════════
//  ORDERS  (Authenticated users, Vendors, Admin)
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/orders', validateBody(createOrderSchema), asyncHandler((req, res) => createOrder(req as AuthRequest, res)));
router.get('/orders', validateQuery(getOrdersQuerySchema), asyncHandler((req, res) => getOrders(req as AuthRequest, res)));
router.get('/orders/:id', asyncHandler((req, res) => getOrderById(req as AuthRequest, res)));
router.post('/orders/:id/cancel', validateBody(cancelOrderSchema), asyncHandler((req, res) => cancelOrder(req as AuthRequest, res)));
router.post('/orders/:id/return', validateBody(returnOrderSchema), asyncHandler((req, res) => returnOrder(req as AuthRequest, res)));
router.get('/orders/:id/status-history', asyncHandler((req, res) => getOrderStatusHistory(req as AuthRequest, res)));

// Order payments
router.post('/orders/:id/payments', validateBody(createPaymentSchema), asyncHandler((req, res) => createPayment(req as AuthRequest, res)));
router.get('/orders/:id/payments', asyncHandler((req, res) => getPayments(req as AuthRequest, res)));

// Vendor order status management
router.put('/orders/:id/status', authorize('VENDOR'), validateBody(updateOrderStatusSchema), asyncHandler((req, res) => updateOrderStatus(req as AuthRequest, res)));

// ═══════════════════════════════════════════════════════════════════════════════
//  SHIPMENTS  (Vendor/Admin only)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/orders/:id/shipments', asyncHandler((req, res) => getShipments(req as AuthRequest, res)));
router.post('/orders/:id/shipments', authorize('VENDOR', 'ADMIN'), validateBody(createShipmentSchema), asyncHandler((req, res) => createShipment(req as AuthRequest, res)));
router.put('/shipments/:shipmentId', authorize('VENDOR', 'ADMIN'), validateBody(updateShipmentSchema), asyncHandler((req, res) => updateShipment(req as AuthRequest, res)));
router.post('/shipments/:shipmentId/events', authorize('VENDOR', 'ADMIN'), validateBody(addShipmentEventSchema), asyncHandler((req, res) => addShipmentEvent(req as AuthRequest, res)));
router.get('/shipments/:shipmentId/events', asyncHandler((req, res) => getShipmentEvents(req as AuthRequest, res)));

export default router;
