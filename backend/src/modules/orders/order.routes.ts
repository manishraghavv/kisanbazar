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

// Mounted at explicit prefixes in server.ts (/api/cart, /api/wishlist, /api/orders, /api/shipments).
// Auth is applied per route so nothing else under /api is gated by accident.
const cartRouter = Router();
const wishlistRouter = Router();
const orderRouter = Router();
const shipmentRouter = Router();

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

// ═══════════════════════════════════════════════════════════════════════════════
//  CART  (Any authenticated user)
// ═══════════════════════════════════════════════════════════════════════════════

cartRouter.get('/', authenticate, asyncHandler((req, res) => getCart(req as AuthRequest, res)));
cartRouter.post('/items', authenticate, validateBody(addCartItemSchema), asyncHandler((req, res) => addCartItem(req as AuthRequest, res)));
cartRouter.put('/items/:itemId', authenticate, validateBody(updateCartItemSchema), asyncHandler((req, res) => updateCartItem(req as AuthRequest, res)));
cartRouter.delete('/items/:itemId', authenticate, asyncHandler((req, res) => removeCartItem(req as AuthRequest, res)));
cartRouter.delete('/', authenticate, asyncHandler((req, res) => clearCart(req as AuthRequest, res)));
cartRouter.post('/merge', authenticate, validateBody(mergeCartSchema), asyncHandler((req, res) => mergeCart(req as AuthRequest, res)));

// ═══════════════════════════════════════════════════════════════════════════════
//  WISHLIST  (Any authenticated user)
// ═══════════════════════════════════════════════════════════════════════════════

wishlistRouter.get('/', authenticate, asyncHandler((req, res) => getWishlist(req as AuthRequest, res)));
wishlistRouter.post('/items', authenticate, validateBody(addWishlistItemSchema), asyncHandler((req, res) => addWishlistItem(req as AuthRequest, res)));
wishlistRouter.delete('/items/:itemId', authenticate, asyncHandler((req, res) => removeWishlistItem(req as AuthRequest, res)));
wishlistRouter.post('/items/:itemId/move', authenticate, asyncHandler((req, res) => moveWishlistToCart(req as AuthRequest, res)));

// ═══════════════════════════════════════════════════════════════════════════════
//  ORDERS  (Authenticated users, Vendors, Admin)
// ═══════════════════════════════════════════════════════════════════════════════

orderRouter.post('/', authenticate, validateBody(createOrderSchema), asyncHandler((req, res) => createOrder(req as AuthRequest, res)));
orderRouter.get('/', authenticate, validateQuery(getOrdersQuerySchema), asyncHandler((req, res) => getOrders(req as AuthRequest, res)));
orderRouter.get('/:id', authenticate, asyncHandler((req, res) => getOrderById(req as AuthRequest, res)));
orderRouter.post('/:id/cancel', authenticate, validateBody(cancelOrderSchema), asyncHandler((req, res) => cancelOrder(req as AuthRequest, res)));
orderRouter.post('/:id/return', authenticate, validateBody(returnOrderSchema), asyncHandler((req, res) => returnOrder(req as AuthRequest, res)));
orderRouter.get('/:id/status-history', authenticate, asyncHandler((req, res) => getOrderStatusHistory(req as AuthRequest, res)));

// Order payments
orderRouter.post('/:id/payments', authenticate, validateBody(createPaymentSchema), asyncHandler((req, res) => createPayment(req as AuthRequest, res)));
orderRouter.get('/:id/payments', authenticate, asyncHandler((req, res) => getPayments(req as AuthRequest, res)));

// Vendor order status management
orderRouter.put('/:id/status', authenticate, authorize('VENDOR'), validateBody(updateOrderStatusSchema), asyncHandler((req, res) => updateOrderStatus(req as AuthRequest, res)));

// ═══════════════════════════════════════════════════════════════════════════════
//  SHIPMENTS  (Vendor/Admin only)
// ═══════════════════════════════════════════════════════════════════════════════

orderRouter.get('/:id/shipments', authenticate, asyncHandler((req, res) => getShipments(req as AuthRequest, res)));
orderRouter.post('/:id/shipments', authenticate, authorize('VENDOR', 'ADMIN'), validateBody(createShipmentSchema), asyncHandler((req, res) => createShipment(req as AuthRequest, res)));
shipmentRouter.put('/:shipmentId', authenticate, authorize('VENDOR', 'ADMIN'), validateBody(updateShipmentSchema), asyncHandler((req, res) => updateShipment(req as AuthRequest, res)));
shipmentRouter.post('/:shipmentId/events', authenticate, authorize('VENDOR', 'ADMIN'), validateBody(addShipmentEventSchema), asyncHandler((req, res) => addShipmentEvent(req as AuthRequest, res)));
shipmentRouter.get('/:shipmentId/events', authenticate, asyncHandler((req, res) => getShipmentEvents(req as AuthRequest, res)));

export { cartRouter, wishlistRouter, orderRouter, shipmentRouter };
