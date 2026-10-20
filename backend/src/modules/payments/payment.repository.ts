import { injectable } from 'tsyringe';
import { BaseRepository } from '../../common/lib/base.repository';

@injectable()
export class PaymentRepository extends BaseRepository {
  // ── Payments ──────────────────────────────────────────────────────────────
  findPaymentById(id: string, include?: any) {
    return this.prisma.payment.findUnique({ where: { id }, ...(include ? { include } : {}) });
  }
  createPayment(data: any) {
    return this.prisma.payment.create({ data });
  }
  updatePayment(id: string, data: any) {
    return this.prisma.payment.update({ where: { id }, data });
  }
  listPayments(where: any, skip: number, take: number) {
    return this.prisma.payment.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { order: { select: { orderNumber: true } } },
    });
  }
  countPayments(where: any) {
    return this.prisma.payment.count({ where });
  }
  findPaymentByOrder(orderId: string, status: string) {
    return this.prisma.payment.findFirst({ where: { orderId, status: status as any } });
  }

  // ── Refunds ───────────────────────────────────────────────────────────────
  createRefund(data: any) {
    return this.prisma.refunds.create({ data });
  }

  // ── Wallet ────────────────────────────────────────────────────────────────
  findOrCreateWallet(userId: string) {
    return this.prisma.wallet.upsert({
      where: { userId },
      create: { userId },
      update: {},
      include: { _count: { select: { transactions: true } } },
    });
  }
  updateWallet(id: string, data: any) {
    return this.prisma.wallet.update({ where: { id }, data });
  }
  createWalletTransaction(data: any) {
    return this.prisma.walletTransaction.create({ data });
  }
  listWalletTransactions(walletId: string, where: any, skip: number, take: number) {
    return this.prisma.walletTransaction.findMany({
      where: { walletId, ...where },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }
  countWalletTransactions(walletId: string, where: any) {
    return this.prisma.walletTransaction.count({ where: { walletId, ...where } });
  }

  // ── Coupons ───────────────────────────────────────────────────────────────
  findCouponByCode(code: string) {
    return this.prisma.coupon.findUnique({ where: { code } });
  }
  findCouponById(id: string) {
    return this.prisma.coupon.findUnique({ where: { id } });
  }
  createCoupon(data: any) {
    return this.prisma.coupon.create({ data });
  }
  updateCoupon(id: string, data: any) {
    return this.prisma.coupon.update({ where: { id }, data });
  }
  deleteCoupon(id: string) {
    return this.prisma.coupon.delete({ where: { id } });
  }
  listCoupons(where: any, skip: number, take: number) {
    return this.prisma.coupon.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } });
  }
  countCoupons(where: any) {
    return this.prisma.coupon.count({ where });
  }

  // ── Settlements ───────────────────────────────────────────────────────────
  findVendorById(id: string) {
    return this.prisma.vendor.findUnique({ where: { id } });
  }
  findVendorByUserId(userId: string) {
    return this.prisma.vendor.findUnique({ where: { userId } });
  }
  listCommissions(where: any, skip: number, take: number) {
    return this.prisma.vendorCommission.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { order: { select: { orderNumber: true, totalAmount: true } } },
    });
  }
  countCommissions(where: any) {
    return this.prisma.vendorCommission.count({ where });
  }
  createSettlement(data: any) {
    return this.prisma.vendorSettlement.create({ data });
  }
  findSettlementById(id: string) {
    return this.prisma.vendorSettlement.findUnique({ where: { id } });
  }
  updateSettlement(id: string, data: any) {
    return this.prisma.vendorSettlement.update({ where: { id }, data });
  }
  listSettlements(where: any, skip: number, take: number) {
    return this.prisma.vendorSettlement.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } });
  }
  countSettlements(where: any) {
    return this.prisma.vendorSettlement.count({ where });
  }

  // ── Orders ────────────────────────────────────────────────────────────────
  findOrderById(id: string, include?: any) {
    return this.prisma.order.findUnique({ where: { id }, ...(include ? { include } : {}) });
  }
  updateOrder(id: string, data: any) {
    return this.prisma.order.update({ where: { id }, data });
  }
  createStatusHistory(data: any) {
    return this.prisma.orderStatusHistory.create({ data });
  }
  findActiveReturns(orderIds: string[]) {
    return this.prisma.returns.findFirst({
      where: { orderId: { in: orderIds }, status: { in: ['REQUESTED', 'APPROVED', 'PICKED'] } },
    });
  }
  findCancelledOrders(orderIds: string[]) {
    return this.prisma.order.findFirst({
      where: { id: { in: orderIds }, status: { in: ['CANCELLED', 'RETURNED', 'REFUNDED'] } },
    });
  }
  findDeliveredOrderIds(orderIds: string[]) {
    return this.prisma.order.findMany({ where: { id: { in: orderIds }, status: 'DELIVERED' }, select: { id: true } });
  }
}
