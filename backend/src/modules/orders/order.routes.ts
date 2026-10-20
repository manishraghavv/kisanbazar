import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../common/middleware/authMiddleware';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AuthRequest } from '../../common/types/express.d';
import {
  listSubOrders,
  getSubOrder,
  updateSubOrderStatus,
  cancelSubOrder,
  createSubOrderShipment,
  requestReturn,
  listReturns,
  getReturn,
  approveReturn,
  rejectReturn,
  receiveReturn,
  resolveReturn,
  listSubOrderInvoices,
  downloadSubOrderInvoice,
  getInvoice,
  downloadInvoicePdf,
} from './subOrder.controller';
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
  quoteOrder,
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
  quoteOrderSchema,
  cancelSubOrderSchema,
  listSubOrdersQuerySchema,
  createReturnSchema,
  listReturnsQuerySchema,
  approveReturnSchema,
  rejectReturnSchema,
  receiveReturnSchema,
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

cartRouter.get(
  '/',
  authenticate,
  asyncHandler((req, res) => getCart(req as AuthRequest, res)),
);
cartRouter.post(
  '/items',
  authenticate,
  validateBody(addCartItemSchema),
  asyncHandler((req, res) => addCartItem(req as AuthRequest, res)),
);
cartRouter.put(
  '/items/:itemId',
  authenticate,
  validateBody(updateCartItemSchema),
  asyncHandler((req, res) => updateCartItem(req as AuthRequest, res)),
);
cartRouter.delete(
  '/items/:itemId',
  authenticate,
  asyncHandler((req, res) => removeCartItem(req as AuthRequest, res)),
);
cartRouter.delete(
  '/',
  authenticate,
  asyncHandler((req, res) => clearCart(req as AuthRequest, res)),
);
cartRouter.post(
  '/merge',
  authenticate,
  validateBody(mergeCartSchema),
  asyncHandler((req, res) => mergeCart(req as AuthRequest, res)),
);

// ═══════════════════════════════════════════════════════════════════════════════
//  WISHLIST  (Any authenticated user)
// ═══════════════════════════════════════════════════════════════════════════════

wishlistRouter.get(
  '/',
  authenticate,
  asyncHandler((req, res) => getWishlist(req as AuthRequest, res)),
);
wishlistRouter.post(
  '/items',
  authenticate,
  validateBody(addWishlistItemSchema),
  asyncHandler((req, res) => addWishlistItem(req as AuthRequest, res)),
);
wishlistRouter.delete(
  '/items/:itemId',
  authenticate,
  asyncHandler((req, res) => removeWishlistItem(req as AuthRequest, res)),
);
wishlistRouter.post(
  '/items/:itemId/move',
  authenticate,
  asyncHandler((req, res) => moveWishlistToCart(req as AuthRequest, res)),
);

// ═══════════════════════════════════════════════════════════════════════════════
//  ORDERS  (Authenticated users, Vendors, Admin)
// ═══════════════════════════════════════════════════════════════════════════════

// Read-only price breakdown for the cart (per-vendor split, GST, delivery) - declared before the /:id routes.
orderRouter.post(
  '/quote',
  authenticate,
  validateBody(quoteOrderSchema),
  asyncHandler((req, res) => quoteOrder(req as AuthRequest, res)),
);
orderRouter.post(
  '/',
  authenticate,
  validateBody(createOrderSchema),
  asyncHandler((req, res) => createOrder(req as AuthRequest, res)),
);
orderRouter.get(
  '/',
  authenticate,
  validateQuery(getOrdersQuerySchema),
  asyncHandler((req, res) => getOrders(req as AuthRequest, res)),
);
orderRouter.get(
  '/:id',
  authenticate,
  asyncHandler((req, res) => getOrderById(req as AuthRequest, res)),
);
orderRouter.post(
  '/:id/cancel',
  authenticate,
  validateBody(cancelOrderSchema),
  asyncHandler((req, res) => cancelOrder(req as AuthRequest, res)),
);
orderRouter.get(
  '/:id/status-history',
  authenticate,
  asyncHandler((req, res) => getOrderStatusHistory(req as AuthRequest, res)),
);

// Order payments
orderRouter.post(
  '/:id/payments',
  authenticate,
  validateBody(createPaymentSchema),
  asyncHandler((req, res) => createPayment(req as AuthRequest, res)),
);
orderRouter.get(
  '/:id/payments',
  authenticate,
  asyncHandler((req, res) => getPayments(req as AuthRequest, res)),
);

// Vendor order status management
orderRouter.put(
  '/:id/status',
  authenticate,
  authorize('VENDOR'),
  validateBody(updateOrderStatusSchema),
  asyncHandler((req, res) => updateOrderStatus(req as AuthRequest, res)),
);

// ═══════════════════════════════════════════════════════════════════════════════
//  SHIPMENTS  (Vendor/Admin only)
// ═══════════════════════════════════════════════════════════════════════════════

orderRouter.get(
  '/:id/shipments',
  authenticate,
  asyncHandler((req, res) => getShipments(req as AuthRequest, res)),
);
orderRouter.post(
  '/:id/shipments',
  authenticate,
  authorize('VENDOR', 'ADMIN'),
  validateBody(createShipmentSchema),
  asyncHandler((req, res) => createShipment(req as AuthRequest, res)),
);
shipmentRouter.put(
  '/:shipmentId',
  authenticate,
  authorize('VENDOR', 'ADMIN'),
  validateBody(updateShipmentSchema),
  asyncHandler((req, res) => updateShipment(req as AuthRequest, res)),
);
shipmentRouter.post(
  '/:shipmentId/events',
  authenticate,
  authorize('VENDOR', 'ADMIN'),
  validateBody(addShipmentEventSchema),
  asyncHandler((req, res) => addShipmentEvent(req as AuthRequest, res)),
);
shipmentRouter.get(
  '/:shipmentId/events',
  authenticate,
  asyncHandler((req, res) => getShipmentEvents(req as AuthRequest, res)),
);

// ═══════════════════════════════════════════════════════════════════════════════
//  SUB-ORDERS (one per vendor)  -  mounted at /api/sub-orders
// ═══════════════════════════════════════════════════════════════════════════════

const subOrderRouter = Router();
subOrderRouter.get(
  '/',
  authenticate,
  validateQuery(listSubOrdersQuerySchema),
  asyncHandler((req, res) => listSubOrders(req as AuthRequest, res)),
);
subOrderRouter.get(
  '/:id',
  authenticate,
  asyncHandler((req, res) => getSubOrder(req as AuthRequest, res)),
);
subOrderRouter.put(
  '/:id/status',
  authenticate,
  authorize('VENDOR', 'ADMIN'),
  validateBody(updateOrderStatusSchema),
  asyncHandler((req, res) => updateSubOrderStatus(req as AuthRequest, res)),
);
subOrderRouter.post(
  '/:id/cancel',
  authenticate,
  validateBody(cancelSubOrderSchema),
  asyncHandler((req, res) => cancelSubOrder(req as AuthRequest, res)),
);
subOrderRouter.post(
  '/:id/shipments',
  authenticate,
  authorize('VENDOR', 'ADMIN'),
  validateBody(createShipmentSchema),
  asyncHandler((req, res) => createSubOrderShipment(req as AuthRequest, res)),
);
subOrderRouter.post(
  '/:id/returns',
  authenticate,
  validateBody(createReturnSchema),
  asyncHandler((req, res) => requestReturn(req as AuthRequest, res)),
);
subOrderRouter.get(
  '/:id/invoices',
  authenticate,
  asyncHandler((req, res) => listSubOrderInvoices(req as AuthRequest, res)),
);
subOrderRouter.get(
  '/:id/invoice',
  authenticate,
  asyncHandler((req, res) => downloadSubOrderInvoice(req as AuthRequest, res)),
);

// ═══════════════════════════════════════════════════════════════════════════════
//  RETURNS  -  mounted at /api/returns
// ═══════════════════════════════════════════════════════════════════════════════

const returnRouter = Router();
returnRouter.get(
  '/',
  authenticate,
  validateQuery(listReturnsQuerySchema),
  asyncHandler((req, res) => listReturns(req as AuthRequest, res)),
);
returnRouter.get(
  '/:id',
  authenticate,
  asyncHandler((req, res) => getReturn(req as AuthRequest, res)),
);
returnRouter.put(
  '/:id/approve',
  authenticate,
  authorize('VENDOR', 'ADMIN'),
  validateBody(approveReturnSchema),
  asyncHandler((req, res) => approveReturn(req as AuthRequest, res)),
);
returnRouter.put(
  '/:id/reject',
  authenticate,
  authorize('VENDOR', 'ADMIN'),
  validateBody(rejectReturnSchema),
  asyncHandler((req, res) => rejectReturn(req as AuthRequest, res)),
);
returnRouter.put(
  '/:id/receive',
  authenticate,
  authorize('VENDOR', 'ADMIN'),
  validateBody(receiveReturnSchema),
  asyncHandler((req, res) => receiveReturn(req as AuthRequest, res)),
);
returnRouter.post(
  '/:id/resolve',
  authenticate,
  authorize('VENDOR', 'ADMIN'),
  asyncHandler((req, res) => resolveReturn(req as AuthRequest, res)),
);

// ═══════════════════════════════════════════════════════════════════════════════
//  INVOICES / CREDIT NOTES  -  mounted at /api/invoices
// ═══════════════════════════════════════════════════════════════════════════════

const invoiceDocsRouter = Router();
invoiceDocsRouter.get(
  '/:id',
  authenticate,
  asyncHandler((req, res) => getInvoice(req as AuthRequest, res)),
);
invoiceDocsRouter.get(
  '/:id/pdf',
  authenticate,
  asyncHandler((req, res) => downloadInvoicePdf(req as AuthRequest, res)),
);

export { cartRouter, wishlistRouter, orderRouter, shipmentRouter, subOrderRouter, returnRouter, invoiceDocsRouter };
