import { Prisma, OrderStatus } from '@prisma/client';
import { prisma } from '../../common/lib/prisma';
import { ForbiddenError, NotFoundError, ConflictError, BadRequestError } from '../../common/errors';
import { LEDGER_TX_OPTIONS } from '../khata/khata.ledger';
import { creditWallet } from '../payments/wallet.ledger';
import { CheckoutInput, createOrder, quoteOrder } from './order.checkout';
import { Actor, SUB_ORDER_INCLUDE, SubOrderService, loadSubOrderForSeller } from './subOrder.service';

export const CartService = {
  async getCart(userId: string) {
    let cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            variant: {
              select: {
                id: true,
                sku: true,
                variantName: true,
                mrp: true,
                sellingPrice: true,
                stockQuantity: true,
                reservedQty: true,
                weightGrams: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    images: { where: { isPrimary: true }, take: 1, select: { imageUrl: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
        include: {
          items: {
            include: {
              variant: {
                select: {
                  id: true,
                  sku: true,
                  variantName: true,
                  mrp: true,
                  sellingPrice: true,
                  stockQuantity: true,
                  reservedQty: true,
                },
              },
            },
          },
        },
      });
    }
    return cart;
  },

  async addItem(userId: string, variantId: string, quantity: number) {
    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) throw new NotFoundError('Variant not found');
    const available = variant.stockQuantity - variant.reservedQty;
    if (available < quantity)
      throw new BadRequestError(`Insufficient stock. Available: ${available}, Requested: ${quantity}`);
    let cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId } });
    }
    const existingItem = await prisma.cartItem.findFirst({ where: { cartId: cart.id, variantId } });
    if (existingItem) {
      const newQty = existingItem.quantity + quantity;
      if (newQty > 99) throw new BadRequestError('Cart item quantity cannot exceed 99');
      if (available < newQty)
        throw new BadRequestError(`Insufficient stock. Available: ${available}, Requested: ${newQty}`);
      await prisma.productVariant.update({ where: { id: variantId }, data: { reservedQty: { increment: quantity } } });
      return prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQty },
        include: {
          variant: {
            select: {
              id: true,
              sku: true,
              variantName: true,
              mrp: true,
              sellingPrice: true,
              stockQuantity: true,
              reservedQty: true,
            },
          },
        },
      });
    }
    await prisma.productVariant.update({ where: { id: variantId }, data: { reservedQty: { increment: quantity } } });
    return prisma.cartItem.create({
      data: { cartId: cart.id, variantId, quantity },
      include: {
        variant: {
          select: {
            id: true,
            sku: true,
            variantName: true,
            mrp: true,
            sellingPrice: true,
            stockQuantity: true,
            reservedQty: true,
          },
        },
      },
    });
  },

  async updateItem(userId: string, itemId: string, quantity: number) {
    const item = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: {
        cart: { select: { userId: true } },
        variant: { select: { id: true, stockQuantity: true, reservedQty: true } },
      },
    });
    if (!item) throw new NotFoundError('Cart item not found');
    if (item.cart.userId !== userId) throw new ForbiddenError('Access denied');
    const available = item.variant.stockQuantity - item.variant.reservedQty + item.quantity;
    if (available < quantity)
      throw new BadRequestError(`Insufficient stock. Available: ${available}, Requested: ${quantity}`);
    await prisma.productVariant.update({
      where: { id: item.variantId },
      data: { reservedQty: { increment: quantity - item.quantity } },
    });
    return prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
  },

  async removeItem(userId: string, itemId: string) {
    const item = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: { select: { userId: true } } },
    });
    if (!item) throw new NotFoundError('Cart item not found');
    if (item.cart.userId !== userId) throw new ForbiddenError('Access denied');
    await prisma.productVariant.update({
      where: { id: item.variantId },
      data: { reservedQty: { increment: -item.quantity } },
    });
    await prisma.cartItem.delete({ where: { id: itemId } });
  },

  async clearCart(userId: string) {
    const cart = await prisma.cart.findUnique({ where: { userId }, include: { items: true } });
    if (!cart) return;
    for (const item of cart.items) {
      await prisma.productVariant.update({
        where: { id: item.variantId },
        data: { reservedQty: { increment: -item.quantity } },
      });
    }
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  },

  async mergeCart(userId: string, items: { variantId: string; quantity: number }[]) {
    const cart = await CartService.getCart(userId);
    for (const incoming of items) {
      const existing = cart.items.find((i) => i.variantId === incoming.variantId);
      const qty = existing ? existing.quantity + incoming.quantity : incoming.quantity;
      if (existing) {
        await CartService.updateItem(userId, existing.id, Math.min(qty, 99));
      } else {
        await CartService.addItem(userId, incoming.variantId, incoming.quantity);
      }
    }
    return CartService.getCart(userId);
  },
};

export const WishlistService = {
  async getWishlist(userId: string) {
    let wishlist = await prisma.wishlist.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                images: { where: { isPrimary: true }, take: 1, select: { imageUrl: true } },
                variants: {
                  select: { id: true, sellingPrice: true, mrp: true },
                  orderBy: { sellingPrice: 'asc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
    if (!wishlist) {
      wishlist = await prisma.wishlist.create({
        data: { userId },
        include: { items: { include: { product: { select: { id: true, name: true, slug: true } } } } },
      });
    }
    return wishlist;
  },

  async addItem(userId: string, productId: string) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError('Product not found');
    let wishlist = await prisma.wishlist.findUnique({ where: { userId } });
    if (!wishlist) {
      wishlist = await prisma.wishlist.create({ data: { userId } });
    }
    const existing = await prisma.wishlistItem.findFirst({ where: { wishlistId: wishlist.id, productId } });
    if (existing) throw new ConflictError('Product already in wishlist');
    return prisma.wishlistItem.create({
      data: { wishlistId: wishlist.id, productId },
      include: { product: { select: { id: true, name: true, slug: true } } },
    });
  },

  async removeItem(userId: string, itemId: string) {
    const item = await prisma.wishlistItem.findUnique({
      where: { id: itemId },
      include: { wishlist: { select: { userId: true } } },
    });
    if (!item) throw new NotFoundError('Wishlist item not found');
    if (item.wishlist.userId !== userId) throw new ForbiddenError('Access denied');
    await prisma.wishlistItem.delete({ where: { id: itemId } });
  },

  async moveToCart(userId: string, itemId: string) {
    const item = await prisma.wishlistItem.findUnique({
      where: { id: itemId },
      include: { wishlist: { select: { userId: true } } },
    });
    if (!item) throw new NotFoundError('Wishlist item not found');
    if (item.wishlist.userId !== userId) throw new ForbiddenError('Access denied');
    const variant = await prisma.productVariant.findFirst({
      where: { productId: item.productId },
      orderBy: { sellingPrice: 'asc' },
    });
    if (!variant) throw new BadRequestError('Product has no variants. Cannot add to cart.');
    await CartService.addItem(userId, variant.id, 1);
    await prisma.wishlistItem.delete({ where: { id: itemId } });
    return { message: 'Item moved to cart', variantId: variant.id };
  },
};

export const OrderService = {
  async create(userId: string, data: CheckoutInput) {
    return createOrder(userId, data);
  },

  async quote(userId: string, data: { addressId: string; couponCode?: string }) {
    return quoteOrder(userId, data);
  },

  async releaseWalletHold(orderId: string, newStatus: string) {
    if (!['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(newStatus)) return;
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true, totalAmount: true, paymentMethod: true, userId: true, status: true },
    });
    if (!order || order.paymentMethod !== 'WALLET') return;
    if (newStatus === 'DELIVERED') {
      await prisma.notification.create({
        data: {
          userId: order.userId,
          title: 'Payment Finalized',
          message: `Wallet payment of ₹${order.totalAmount} for order ${order.orderNumber} has been finalized.`,
          type: 'ORDER_UPDATE',
        },
      });
    } else if (['CANCELLED', 'REFUNDED'].includes(newStatus) && order.status !== newStatus) {
      // The idempotency key makes this and cancel() share one refund per order.
      await prisma.$transaction(async (tx) => {
        await creditWallet(tx, order.userId, order.totalAmount, {
          remarks: `Refund for cancelled order ${order.orderNumber}`,
          referenceId: order.id,
          idempotencyKey: `order-refund:${order.orderNumber}`,
        });
      }, LEDGER_TX_OPTIONS);
    }
  },

  /**
   * One order with its sub-orders. A customer sees everything of their order; a vendor sees ONLY their own
   * sub-order(s) (other sellers' lines, shipments and invoices are not exposed); admins see all.
   */
  async getById(orderId: string, userId: string, requesterRole: string) {
    let vendorId: string | null = null;
    if (requesterRole === 'VENDOR') {
      vendorId = (await prisma.vendor.findUnique({ where: { userId }, select: { id: true } }))?.id ?? null;
    }
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, fullName: true, phoneNumber: true } },
        address: true,
        subOrders: {
          where: vendorId ? { vendorId } : undefined,
          orderBy: { subOrderNumber: 'asc' },
          include: SUB_ORDER_INCLUDE,
        },
        payments: true,
        statusHistory: { orderBy: { changedAt: 'desc' } },
        refunds: true,
      },
    });
    if (!order) throw new NotFoundError('Order not found');
    if (requesterRole === 'ADMIN' || order.userId === userId) {
      return OrderService.withFlatItems(order);
    }
    if (!vendorId || order.subOrders.length === 0) throw new ForbiddenError('Access denied');
    // Vendors do not see the customer's payments or the other sellers' status history.
    return OrderService.withFlatItems({
      ...order,
      payments: [],
      refunds: [],
      statusHistory: order.statusHistory.filter(
        (h) => h.subOrderId && order.subOrders.some((s) => s.id === h.subOrderId),
      ),
    });
  },

  /** Keeps the legacy flat `items` / `shipments` / `returns` arrays that older clients read, built from the sub-orders. */
  withFlatItems<T extends { subOrders: Array<{ items: unknown[]; shipments: unknown[]; returns: unknown[] }> }>(
    order: T,
  ) {
    return {
      ...order,
      items: order.subOrders.flatMap((s) => s.items),
      shipments: order.subOrders.flatMap((s) => s.shipments),
      returns: order.subOrders.flatMap((s) => s.returns),
    };
  },

  async list(
    userId: string,
    requesterRole: string,
    filters: { page: number; limit: number; status?: string; startDate?: string; endDate?: string },
  ) {
    const { page, limit, status, startDate, endDate } = filters;
    const skip = (page - 1) * limit;
    const where: Prisma.OrderWhereInput = {};
    if (requesterRole === 'VENDOR') {
      const vendor = await prisma.vendor.findUnique({ where: { userId } });
      if (!vendor) throw new ForbiddenError('Vendor profile not found');
      where.subOrders = { some: { vendorId: vendor.id } };
    } else if (requesterRole !== 'ADMIN') {
      where.userId = userId;
    }
    if (status) where.status = status as OrderStatus;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, fullName: true, phoneNumber: true } },
          subOrders: {
            where: requesterRole === 'VENDOR' ? { vendor: { userId } } : undefined,
            orderBy: { subOrderNumber: 'asc' },
            select: {
              id: true,
              subOrderNumber: true,
              status: true,
              totalAmount: true,
              vendor: { select: { id: true, businessName: true } },
              items: {
                select: {
                  id: true,
                  quantity: true,
                  unitPrice: true,
                  variant: { select: { sku: true, variantName: true, product: { select: { name: true } } } },
                },
              },
            },
          },
          _count: { select: { payments: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);
    // `items` stays available as a flat list for older clients.
    const flat = orders.map((o) => ({ ...o, items: o.subOrders.flatMap((s) => s.items) }));
    return { orders: flat, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  /** Customer cancels the order: every sub-order that is still PENDING/CONFIRMED is cancelled and refunded. */
  async cancel(orderId: string, userId: string, reason: string) {
    return SubOrderService.cancelOrderAsCustomer(userId, orderId, reason);
  },

  async addPayment(
    orderId: string,
    userId: string,
    requesterRole: string,
    data: { amount: number; paymentMethod: string; gateway?: string; transactionId?: string; idempotencyKey?: string },
  ) {
    await OrderService.getById(orderId, userId, requesterRole);
    if (data.idempotencyKey) {
      const existing = await prisma.payment.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
      if (existing) throw new ConflictError('Payment with this idempotency key already exists');
    }
    return prisma.payment.create({
      data: {
        orderId,
        amount: new Prisma.Decimal(data.amount),
        paymentMethod: data.paymentMethod as any,
        gateway: data.gateway,
        transactionId: data.transactionId,
        idempotencyKey: data.idempotencyKey,
        status: 'PENDING',
        paidAt: data.transactionId ? new Date() : undefined,
      },
    });
  },

  async getPayments(orderId: string, userId: string, requesterRole: string) {
    await OrderService.getById(orderId, userId, requesterRole);
    return prisma.payment.findMany({ where: { orderId }, orderBy: { createdAt: 'desc' } });
  },

  async getStatusHistory(orderId: string, userId: string, requesterRole: string) {
    await OrderService.getById(orderId, userId, requesterRole);
    return prisma.orderStatusHistory.findMany({ where: { orderId }, orderBy: { changedAt: 'desc' } });
  },

  /**
   * Legacy route `PUT /orders/:id/status`. It now acts on the CALLER'S OWN sub-order of that order (a vendor can no
   * longer move another vendor's goods); the parent order status is derived.
   */
  async updateOrderStatus(orderId: string, vendorUserId: string, data: { status: string; remarks?: string }) {
    const vendor = await prisma.vendor.findUnique({ where: { userId: vendorUserId } });
    if (!vendor) throw new ForbiddenError('Vendor profile not found');
    const own = await prisma.subOrder.findUnique({ where: { orderId_vendorId: { orderId, vendorId: vendor.id } } });
    if (!own) throw new ForbiddenError('No part of this order belongs to your shop');
    const result = await SubOrderService.updateStatus({ id: vendorUserId, role: 'VENDOR' }, own.id, data);
    if (data.status === 'DELIVERED') await OrderService.releaseWalletHold(orderId, 'DELIVERED');
    return result.subOrder;
  },
};

/**
 * Shipments belong to a SUB-ORDER, so they follow the same ownership rule: a seller creates and updates shipments only
 * for their own sub-orders; the customer can follow every shipment of their order; admins can do both.
 */
export const ShipmentService = {
  async create(
    actor: Actor,
    subOrderId: string,
    data: { logisticsPartner?: string; awbNumber?: string; pickupEta?: Date; deliveryEta?: Date },
  ) {
    const so = await loadSubOrderForSeller(subOrderId, actor);
    if (!['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED'].includes(so.status)) {
      throw new BadRequestError(`Cannot create a shipment for a ${so.status} sub-order`);
    }
    return prisma.shipment.create({
      data: {
        orderId: so.orderId,
        subOrderId,
        logisticsPartner: data.logisticsPartner,
        awbNumber: data.awbNumber,
        pickupEta: data.pickupEta,
        deliveryEta: data.deliveryEta,
      },
    });
  },

  /** Legacy `POST /orders/:id/shipments`: a vendor ships their own part; an admin must name the sub-order. */
  async createForOrder(
    actor: Actor,
    orderId: string,
    data: { subOrderId?: string; logisticsPartner?: string; awbNumber?: string; pickupEta?: Date; deliveryEta?: Date },
  ) {
    const { subOrderId: requested, ...rest } = data;
    let subOrderId = requested;
    if (actor.role === 'VENDOR') {
      const vendor = await prisma.vendor.findUnique({ where: { userId: actor.id }, select: { id: true } });
      const own = vendor
        ? await prisma.subOrder.findUnique({ where: { orderId_vendorId: { orderId, vendorId: vendor.id } } })
        : null;
      if (!own) throw new ForbiddenError('No part of this order belongs to your shop');
      subOrderId = own.id;
    } else if (!subOrderId) {
      const subs = await prisma.subOrder.findMany({ where: { orderId }, select: { id: true } });
      if (subs.length !== 1) throw new BadRequestError('Say which sub-order to ship (subOrderId)');
      subOrderId = subs[0].id;
    }
    return ShipmentService.create(actor, subOrderId!, rest);
  },

  async getByOrder(orderId: string, actor: Actor) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { userId: true } });
    if (!order) throw new NotFoundError('Order not found');
    const where: Prisma.ShipmentWhereInput = { orderId };
    if (actor.role === 'VENDOR') {
      where.subOrder = { vendor: { userId: actor.id } };
    } else if (actor.role !== 'ADMIN' && order.userId !== actor.id) {
      throw new ForbiddenError('Access denied');
    }
    return prisma.shipment.findMany({
      where,
      include: {
        events: { orderBy: { eventTime: 'desc' } },
        subOrder: { select: { id: true, subOrderNumber: true, vendorId: true } },
      },
    });
  },

  async loadForSeller(shipmentId: string, actor: Actor) {
    const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId }, include: { subOrder: true } });
    if (!shipment) throw new NotFoundError('Shipment not found');
    await loadSubOrderForSeller(shipment.subOrderId, actor);
    return shipment;
  },

  async update(actor: Actor, shipmentId: string, data: Record<string, unknown>) {
    await ShipmentService.loadForSeller(shipmentId, actor);
    const updateData: Record<string, unknown> = {};
    for (const field of [
      'logisticsPartner',
      'awbNumber',
      'pickupEta',
      'deliveryEta',
      'podImageUrl',
      'currentStatus',
      'deliveryAttempts',
    ]) {
      if (data[field] !== undefined) updateData[field] = data[field];
    }
    return prisma.shipment.update({ where: { id: shipmentId }, data: updateData as Prisma.ShipmentUpdateInput });
  },

  async addEvent(
    actor: Actor,
    shipmentId: string,
    data: { eventStatus: string; location?: string; geoLat?: number; geoLng?: number; source?: string },
  ) {
    await ShipmentService.loadForSeller(shipmentId, actor);
    return prisma.shipmentEvent.create({
      data: {
        shipmentId,
        eventStatus: data.eventStatus,
        location: data.location,
        geoLat: data.geoLat !== undefined ? new Prisma.Decimal(data.geoLat) : undefined,
        geoLng: data.geoLng !== undefined ? new Prisma.Decimal(data.geoLng) : undefined,
        source: data.source,
      },
    });
  },

  /** Tracking events: the customer, the owning seller and admins may read them. */
  async getEvents(actor: Actor, shipmentId: string) {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { order: { select: { userId: true } }, subOrder: { select: { vendor: { select: { userId: true } } } } },
    });
    if (!shipment) throw new NotFoundError('Shipment not found');
    const allowed =
      actor.role === 'ADMIN' ||
      shipment.order.userId === actor.id ||
      (actor.role === 'VENDOR' && shipment.subOrder.vendor.userId === actor.id);
    if (!allowed) throw new ForbiddenError('Access denied');
    return prisma.shipmentEvent.findMany({ where: { shipmentId }, orderBy: { eventTime: 'desc' } });
  },
};
