import { Response } from 'express';
import { AuthRequest } from '../../common/types/express.d';
import { CartService, WishlistService, OrderService, ShipmentService } from './order.service';

function handleServiceError(err: unknown, res: Response): void {
  const e = err as { status?: number; statusCode?: number; message?: string };
  res.status(e.statusCode ?? e.status ?? 500).json({ success: false, message: e.message ?? 'Internal server error' });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CART
// ═══════════════════════════════════════════════════════════════════════════════

export const getCart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cart = await CartService.getCart(req.user.id);
    res.json({ success: true, data: cart });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const addCartItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const item = await CartService.addItem(req.user.id, req.body.variantId, req.body.quantity);
    res.status(201).json({ success: true, message: 'Item added to cart', data: item });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const updateCartItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const item = await CartService.updateItem(req.user.id, req.params.itemId as string, req.body.quantity);
    res.json({ success: true, message: 'Cart item updated', data: item });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const removeCartItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await CartService.removeItem(req.user.id, req.params.itemId as string);
    res.json({ success: true, message: 'Item removed from cart' });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const clearCart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await CartService.clearCart(req.user.id);
    res.json({ success: true, message: 'Cart cleared' });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const mergeCart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cart = await CartService.mergeCart(req.user.id, req.body.items);
    res.json({ success: true, message: 'Cart merged', data: cart });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  WISHLIST
// ═══════════════════════════════════════════════════════════════════════════════

export const getWishlist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const wishlist = await WishlistService.getWishlist(req.user.id);
    res.json({ success: true, data: wishlist });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const addWishlistItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const item = await WishlistService.addItem(req.user.id, req.body.productId);
    res.status(201).json({ success: true, message: 'Added to wishlist', data: item });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const removeWishlistItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await WishlistService.removeItem(req.user.id, req.params.itemId as string);
    res.json({ success: true, message: 'Removed from wishlist' });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const moveWishlistToCart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await WishlistService.moveToCart(req.user.id, req.params.itemId as string);
    res.json({ success: true, message: 'Moved to cart', data: result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ORDERS
// ═══════════════════════════════════════════════════════════════════════════════

export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order = await OrderService.create(req.user.id, req.body);
    res.status(201).json({ success: true, message: 'Order placed successfully', data: order });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await OrderService.list(req.user.id, req.user.role, {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      status: req.query.status as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    });
    res.json({
      success: true,
      data: result.orders,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getOrderById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order = await OrderService.getById(req.params.id as string, req.user.id, req.user.role);
    res.json({ success: true, data: order });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const cancelOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await OrderService.cancel(req.params.id as string, req.user.id, req.body.reason);
    res.json({ success: true, message: 'Order cancelled' });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const createPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payment = await OrderService.addPayment(
      req.params.id as string,
      req.user.id,
      req.user.role,
      req.body,
    );
    res.status(201).json({ success: true, message: 'Payment recorded', data: payment });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getPayments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payments = await OrderService.getPayments(
      req.params.id as string,
      req.user.id,
      req.user.role,
    );
    res.json({ success: true, data: payments });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const returnOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await OrderService.requestReturn(req.params.id as string, req.user.id, {
      reason: req.body.reason,
      photoUrls: req.body.photoUrls,
    });
    res.json({ success: true, message: 'Return request submitted' });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getOrderStatusHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const history = await OrderService.getStatusHistory(req.params.id as string, req.user.id, req.user.role);
    res.json({ success: true, data: history });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const updateOrderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order = await OrderService.updateOrderStatus(req.params.id as string, req.user.id, req.body);
    res.json({ success: true, message: `Order status updated to ${req.body.status}`, data: order });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SHIPMENTS
// ═══════════════════════════════════════════════════════════════════════════════

export const createShipment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const shipment = await ShipmentService.create(req.params.id as string, {
      ...req.body,
      ...(req.body.pickupEta && { pickupEta: new Date(req.body.pickupEta) }),
      ...(req.body.deliveryEta && { deliveryEta: new Date(req.body.deliveryEta) }),
    });
    res.status(201).json({ success: true, message: 'Shipment created', data: shipment });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getShipments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const shipments = await ShipmentService.getByOrder(req.params.id as string);
    res.json({ success: true, data: shipments });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const updateShipment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const shipment = await ShipmentService.update(req.params.shipmentId as string, req.body);
    res.json({ success: true, message: 'Shipment updated', data: shipment });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const addShipmentEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const event = await ShipmentService.addEvent(req.params.shipmentId as string, req.body);
    res.status(201).json({ success: true, message: 'Shipment event added', data: event });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getShipmentEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const events = await ShipmentService.getEvents(req.params.shipmentId as string);
    res.json({ success: true, data: events });
  } catch (err) {
    handleServiceError(err, res);
  }
};
