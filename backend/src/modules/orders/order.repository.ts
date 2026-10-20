import { injectable } from 'tsyringe';
import { BaseRepository } from '../../common/lib/base.repository';

@injectable()
export class OrderRepository extends BaseRepository {
  // ── Cart ──────────────────────────────────────────────────────────────────
  findCartByUserId(userId: string, include?: any) {
    return this.prisma.cart.findUnique({ where: { userId }, ...(include ? { include } : {}) });
  }
  createCart(userId: string) {
    return this.prisma.cart.create({
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
  findCartItemById(id: string, include?: any) {
    return this.prisma.cartItem.findUnique({ where: { id }, ...(include ? { include } : {}) });
  }
  findCartItem(cartId: string, variantId: string) {
    return this.prisma.cartItem.findFirst({ where: { cartId, variantId } });
  }
  updateCartItem(id: string, data: any) {
    return this.prisma.cartItem.update({ where: { id }, data });
  }
  deleteCartItem(id: string) {
    return this.prisma.cartItem.delete({ where: { id } });
  }
  deleteCartItems(cartId: string) {
    return this.prisma.cartItem.deleteMany({ where: { cartId } });
  }
  deleteCart(id: string) {
    return this.prisma.cart.delete({ where: { id } });
  }

  // ── Wishlist ──────────────────────────────────────────────────────────────
  findWishlistByUserId(userId: string, include?: any) {
    return this.prisma.wishlist.findUnique({ where: { userId }, ...(include ? { include } : {}) });
  }
  createWishlist(userId: string) {
    return this.prisma.wishlist.create({ data: { userId } });
  }
  findWishlistItem(wishlistId: string, productId: string) {
    return this.prisma.wishlistItem.findFirst({ where: { wishlistId, productId } });
  }
  findWishlistItemById(id: string, include?: any) {
    return this.prisma.wishlistItem.findUnique({ where: { id }, ...(include ? { include } : {}) });
  }
  createWishlistItem(data: any) {
    return this.prisma.wishlistItem.create({ data });
  }
  deleteWishlistItem(id: string) {
    return this.prisma.wishlistItem.delete({ where: { id } });
  }

  // ── Orders ────────────────────────────────────────────────────────────────
  findOrderById(id: string, include?: any) {
    return this.prisma.order.findUnique({ where: { id }, ...(include ? { include } : {}) });
  }
  findLastOrderByPrefix(prefix: string) {
    return this.prisma.order.findFirst({
      where: { orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
  }
  createOrder(data: any) {
    return this.prisma.order.create({ data, include: { items: true } });
  }
  updateOrder(id: string, data: any) {
    return this.prisma.order.update({ where: { id }, data });
  }
  listOrders(where: any, skip: number, take: number) {
    return this.prisma.order.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, fullName: true, phoneNumber: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            variant: { select: { sku: true, variantName: true, product: { select: { name: true } } } },
          },
        },
        _count: { select: { shipments: true, payments: true } },
      },
    });
  }
  countOrders(where: any) {
    return this.prisma.order.count({ where });
  }
  createStatusHistory(data: any) {
    return this.prisma.orderStatusHistory.create({ data });
  }

  // ── Order Items / Commissions ─────────────────────────────────────────────
  createOrderItem(data: any) {
    return this.prisma.orderItem.create({ data });
  }
  createVendorCommission(data: any) {
    return this.prisma.vendorCommission.create({ data });
  }

  // ── Payments ──────────────────────────────────────────────────────────────
  findPaymentByOrder(orderId: string) {
    return this.prisma.payment.findFirst({ where: { orderId, status: 'SUCCESS' } });
  }
  createPayment(data: any) {
    return this.prisma.payment.create({ data });
  }
  listPayments(orderId: string) {
    return this.prisma.payment.findMany({ where: { orderId }, orderBy: { createdAt: 'desc' } });
  }
  findPaymentById(id: string) {
    return this.prisma.payment.findUnique({ where: { id } });
  }

  // ── Returns ───────────────────────────────────────────────────────────────
  createReturn(data: any) {
    return this.prisma.returns.create({ data });
  }

  // ── Wallet ────────────────────────────────────────────────────────────────
  findWalletByUserId(userId: string) {
    return this.prisma.wallet.findUnique({ where: { userId } });
  }
  updateWallet(id: string, data: any) {
    return this.prisma.wallet.update({ where: { id }, data });
  }
  createWalletTransaction(data: any) {
    return this.prisma.walletTransaction.create({ data });
  }

  // ── Khata ─────────────────────────────────────────────────────────────────
  findKhataAccountById(id: string) {
    return this.prisma.khataAccount.findUnique({ where: { id } });
  }
  createKhataTransaction(data: any) {
    return this.prisma.khataTransaction.create({ data });
  }
  updateKhataAccount(id: string, data: any) {
    return this.prisma.khataAccount.update({ where: { id }, data });
  }

  // ── Shipments ─────────────────────────────────────────────────────────────
  createShipment(data: any) {
    return this.prisma.shipment.create({ data });
  }
  findShipmentsByOrder(orderId: string) {
    return this.prisma.shipment.findMany({
      where: { orderId },
      include: { events: { orderBy: { eventTime: 'desc' } } },
    });
  }
  updateShipment(id: string, data: any) {
    return this.prisma.shipment.update({ where: { id }, data });
  }
  createShipmentEvent(data: any) {
    return this.prisma.shipmentEvent.create({ data });
  }
  findShipmentEvents(shipmentId: string) {
    return this.prisma.shipmentEvent.findMany({ where: { shipmentId }, orderBy: { eventTime: 'desc' } });
  }

  // ── Variant ───────────────────────────────────────────────────────────────
  updateVariantStock(id: string, data: any) {
    return this.prisma.productVariant.update({ where: { id }, data });
  }
  findVariantById(id: string, include?: any) {
    return this.prisma.productVariant.findUnique({ where: { id }, ...(include ? { include } : {}) });
  }
  findCheapestVariant(productId: string) {
    return this.prisma.productVariant.findFirst({ where: { productId }, orderBy: { sellingPrice: 'asc' } });
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  createNotification(data: any) {
    return this.prisma.notification.create({ data });
  }
}
