import {
  Prisma,
  PaymentStatus,
  SettlementStatus,
  WalletTransactionType,
} from '@prisma/client';
import crypto from 'crypto';
import { prisma } from '../../common/lib/prisma';
import {
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BadRequestError,
  BadGatewayError,
} from '../../common/errors';

interface PaymentGateway {
  createPaymentLink(amount: number, orderId: string, customer: { name: string; phone: string; email?: string }): Promise<{ paymentUrl: string; transactionId: string }>;
  verifyPayment(paymentId: string, transactionId: string): Promise<{ verified: boolean; gatewayFee?: number }>;
  processRefund(paymentId: string, amount: number): Promise<{ gatewayRefundId: string }>;
}

class RazorpayGateway implements PaymentGateway {
  async createPaymentLink(amount: number, orderId: string, customer: { name: string; phone: string; email?: string }) {
    console.log(`[RAZORPAY] Creating payment link for order ${orderId}: ₹${amount}`);
    return { paymentUrl: `https://rzp.io/i/${crypto.randomBytes(8).toString('hex')}`, transactionId: `rzp_${crypto.randomBytes(12).toString('hex')}` };
  }

  async verifyPayment(paymentId: string, transactionId: string) {
    console.log(`[RAZORPAY] Verifying payment ${paymentId}/${transactionId}`);
    return { verified: true, gatewayFee: 0 };
  }

  async processRefund(paymentId: string, amount: number) {
    console.log(`[RAZORPAY] Processing refund of ₹${amount} for payment ${paymentId}`);
    return { gatewayRefundId: `rfnd_${crypto.randomBytes(12).toString('hex')}` };
  }
}

function getGateway(gateway?: string): PaymentGateway {
  return new RazorpayGateway();
}

export const PaymentService = {
  async initiate(userId: string, data: { orderId: string; paymentMethod: string; gateway?: string }) {
    const order = await prisma.order.findUnique({ where: { id: data.orderId }, include: { user: { select: { fullName: true, phoneNumber: true, email: true } } } });
    if (!order) throw new NotFoundError('Order not found');
    if (order.userId !== userId) throw new ForbiddenError('Access denied');

    const existingPayment = await prisma.payment.findFirst({ where: { orderId: data.orderId, status: 'SUCCESS' } });
    if (existingPayment) throw new BadRequestError('Order already has a successful payment');

    const payment = await prisma.payment.create({
      data: { orderId: data.orderId, amount: order.totalAmount, currency: 'INR', paymentMethod: data.paymentMethod as any, gateway: data.gateway || (data.paymentMethod === 'COD' ? 'cod' : 'razorpay'), status: 'PENDING', idempotencyKey: `pay_${order.id}_${Date.now()}` },
    });

    if (data.paymentMethod === 'COD') { return { payment, message: 'COD payment recorded. Amount will be collected on delivery.' }; }
    if (data.paymentMethod === 'WALLET') { return PaymentService.processWalletPayment(userId, payment.id, order.id, order.totalAmount); }

    const gateway = getGateway(data.gateway);
    try {
      const result = await gateway.createPaymentLink(Number(order.totalAmount), order.id, { name: order.user.fullName, phone: order.user.phoneNumber, email: order.user.email || undefined });
      await prisma.payment.update({ where: { id: payment.id }, data: { transactionId: result.transactionId } });
      return { payment, paymentUrl: result.paymentUrl, transactionId: result.transactionId };
    } catch (err) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
      throw new BadGatewayError('Payment gateway error. Please try again.');
    }
  },

  async verify(userId: string, data: { paymentId: string; transactionId: string; gateway: string }) {
    const payment = await prisma.payment.findUnique({ where: { id: data.paymentId }, include: { order: { select: { userId: true, status: true } } } });
    if (!payment) throw new NotFoundError('Payment not found');
    if (payment.order.status === 'CANCELLED') throw new BadRequestError('Order is cancelled');
    if (payment.status === 'SUCCESS') { return { payment, message: 'Payment already verified' }; }

    const gateway = getGateway(data.gateway);
    const result = await gateway.verifyPayment(data.paymentId, data.transactionId);

    if (result.verified) {
      const updated = await prisma.$transaction(async (tx) => {
        const p = await tx.payment.update({ where: { id: data.paymentId }, data: { status: 'SUCCESS', transactionId: data.transactionId, gatewayFee: result.gatewayFee ? new Prisma.Decimal(result.gatewayFee) : undefined, paidAt: new Date() } });
        const currentOrder = await tx.order.findUnique({ where: { id: payment.orderId } });
        if (currentOrder && currentOrder.status === 'PENDING') {
          await tx.order.update({ where: { id: payment.orderId }, data: { status: 'CONFIRMED' } });
          await tx.orderStatusHistory.create({ data: { orderId: payment.orderId, oldStatus: 'PENDING', newStatus: 'CONFIRMED', changedBy: userId, remarks: 'Payment verified' } });
        }
        return p;
      });
      return { payment: updated, message: 'Payment verified successfully' };
    }

    await prisma.payment.update({ where: { id: data.paymentId }, data: { status: 'FAILED' } });
    throw new BadRequestError('Payment verification failed');
  },

  async processWalletPayment(userId: string, paymentId: string, orderId: string, amount: Prisma.Decimal) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundError('Wallet not found');
    if (wallet.balance.lt(amount)) throw new BadRequestError('Insufficient wallet balance');

    return prisma.$transaction(async (tx) => {
      const newBalance = wallet.balance.sub(amount);
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });
      await tx.walletTransaction.create({ data: { walletId: wallet.id, type: 'DEBIT', amount, balanceAfter: newBalance, remarks: 'Payment for order', referenceId: orderId } });
      const p = await tx.payment.update({ where: { id: paymentId }, data: { status: 'SUCCESS', paidAt: new Date() } });
      const currentOrder = await tx.order.findUnique({ where: { id: orderId } });
      if (currentOrder && currentOrder.status === 'PENDING') {
        await tx.order.update({ where: { id: orderId }, data: { status: 'CONFIRMED' } });
        await tx.orderStatusHistory.create({ data: { orderId, oldStatus: 'PENDING', newStatus: 'CONFIRMED', changedBy: userId, remarks: 'Paid via wallet' } });
      }
      return p;
    });
  },

  async handleWebhook(gateway: string, payload: any) {
    const { paymentId, transactionId, status } = payload;
    if (status === 'captured' || status === 'paid') {
      const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
      if (!payment) throw new NotFoundError('Payment not found');
      await prisma.payment.update({ where: { id: paymentId }, data: { status: 'SUCCESS', transactionId: transactionId || payment.transactionId, paidAt: new Date(), webhookPayload: payload } });
      const order = await prisma.order.findUnique({ where: { id: payment.orderId } });
      if (order && order.status === 'PENDING') { await prisma.order.update({ where: { id: payment.orderId }, data: { status: 'CONFIRMED' } }); }
    }
    return { received: true };
  },

  async getPayment(paymentId: string) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { order: { select: { id: true, orderNumber: true, totalAmount: true, status: true } } } });
    if (!payment) throw new NotFoundError('Payment not found');
    return payment;
  },

  async listPayments(filters: { page: number; limit: number; status?: string; orderId?: string }) {
    const { page, limit, status, orderId } = filters;
    const skip = (page - 1) * limit;
    const where: Prisma.PaymentWhereInput = {};
    if (status) where.status = status as PaymentStatus;
    if (orderId) where.orderId = orderId;
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { order: { select: { orderNumber: true } } } }),
      prisma.payment.count({ where }),
    ]);
    return { payments, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async processRefund(paymentId: string, data: { amount?: number; reason?: string }) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { order: { select: { id: true, orderNumber: true } } } });
    if (!payment) throw new NotFoundError('Payment not found');
    if (payment.status !== 'SUCCESS') throw new BadRequestError('Can only refund successful payments');
    const refundAmount = data.amount ? new Prisma.Decimal(Math.min(data.amount, Number(payment.amount))) : payment.amount;
    const gateway = getGateway(payment.gateway || undefined);
    const refundResult = await gateway.processRefund(paymentId, Number(refundAmount));
    await prisma.$transaction(async (tx) => {
      await tx.refunds.create({ data: { orderId: payment.orderId, amount: refundAmount, reason: data.reason, status: 'PROCESSED', gatewayRefundId: refundResult.gatewayRefundId, processedAt: new Date() } });
      const newStatus = refundAmount.eq(payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      await tx.payment.update({ where: { id: paymentId }, data: { status: newStatus as PaymentStatus } });
      await tx.order.update({ where: { id: payment.orderId }, data: { status: 'REFUNDED' } });
    });
    return { message: `Refund of ₹${refundAmount} processed`, gatewayRefundId: refundResult.gatewayRefundId };
  },
};

export const WalletService = {
  async getWallet(userId: string) {
    let wallet = await prisma.wallet.findUnique({ where: { userId }, include: { _count: { select: { transactions: true } } } });
    if (!wallet) { wallet = await prisma.wallet.create({ data: { userId }, include: { _count: { select: { transactions: true } } } }); }
    return wallet;
  },

  async getBalance(userId: string) {
    const wallet = await WalletService.getWallet(userId);
    return { balance: wallet.balance, walletId: wallet.id };
  },

  async addMoney(userId: string, amount: number, remarks?: string) {
    const wallet = await WalletService.getWallet(userId);
    const decimalAmount = new Prisma.Decimal(amount);
    const newBalance = wallet.balance.add(decimalAmount);
    const [updatedWallet] = await prisma.$transaction([
      prisma.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } }),
      prisma.walletTransaction.create({ data: { walletId: wallet.id, type: 'CREDIT', amount: decimalAmount, balanceAfter: newBalance, remarks: remarks || 'Money added to wallet' } }),
    ]);
    return updatedWallet;
  },

  async getTransactions(userId: string, filters: { page: number; limit: number; type?: string }) {
    const wallet = await WalletService.getWallet(userId);
    const { page, limit, type } = filters;
    const skip = (page - 1) * limit;
    const where: Prisma.WalletTransactionWhereInput = { walletId: wallet.id };
    if (type) where.type = type as WalletTransactionType;
    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.walletTransaction.count({ where }),
    ]);
    return { balance: wallet.balance, transactions, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async useForPayment(userId: string, orderId: string, amount: number) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError('Order not found');
    if (order.userId !== userId) throw new ForbiddenError('Access denied');
    const payment = await prisma.payment.create({ data: { orderId, amount: new Prisma.Decimal(amount), currency: 'INR', paymentMethod: 'WALLET', gateway: 'wallet', status: 'PENDING', idempotencyKey: `wal_${orderId}_${Date.now()}` } });
    return PaymentService.processWalletPayment(userId, payment.id, orderId, new Prisma.Decimal(amount));
  },
};

export const CouponService = {
  async create(data: { code: string; title: string; type: string; value: number; minimumAmount?: number; maximumDiscount?: number; usageLimit?: number; perUserLimit?: number; applicableTo?: string; startsAt: Date; expiresAt: Date; isActive?: boolean }) {
    const existing = await prisma.coupon.findUnique({ where: { code: data.code } });
    if (existing) throw new ConflictError(`Coupon code "${data.code}" already exists`);
    return prisma.coupon.create({
      data: { code: data.code, title: data.title, type: data.type as any, value: new Prisma.Decimal(data.value), minimumAmount: data.minimumAmount ? new Prisma.Decimal(data.minimumAmount) : undefined, maximumDiscount: data.maximumDiscount ? new Prisma.Decimal(data.maximumDiscount) : undefined, usageLimit: data.usageLimit, perUserLimit: data.perUserLimit ?? 1, applicableTo: data.applicableTo ?? 'ALL', startsAt: data.startsAt, expiresAt: data.expiresAt, isActive: data.isActive ?? true },
    });
  },

  async update(id: string, data: any) {
    const coupon = await prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundError('Coupon not found');
    const updateData: Prisma.CouponUpdateInput = {};
    for (const field of ['title', 'type', 'usageLimit', 'perUserLimit', 'applicableTo', 'startsAt', 'expiresAt', 'isActive']) {
      if (data[field] !== undefined) (updateData as any)[field] = data[field];
    }
    for (const field of ['value', 'minimumAmount', 'maximumDiscount']) {
      if (data[field] !== undefined) (updateData as any)[field] = new Prisma.Decimal(data[field]);
    }
    return prisma.coupon.update({ where: { id }, data: updateData });
  },

  async getById(id: string) { return prisma.coupon.findUnique({ where: { id } }); },

  async list(filters: { page: number; limit: number; isActive?: boolean; type?: string }) {
    const { page, limit, isActive, type } = filters;
    const skip = (page - 1) * limit;
    const where: Prisma.CouponWhereInput = {};
    if (isActive !== undefined) where.isActive = isActive;
    if (type) where.type = type as any;
    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.coupon.count({ where }),
    ]);
    return { coupons, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async validate(code: string, subtotal: number, context?: { categoryId?: string; vendorId?: string }) {
    const coupon = await prisma.coupon.findUnique({ where: { code } });
    if (!coupon) throw new NotFoundError('Coupon not found');
    if (!coupon.isActive) throw new BadRequestError('Coupon is not active');
    if (coupon.expiresAt < new Date()) throw new BadRequestError('Coupon has expired');
    if (coupon.startsAt > new Date()) throw new BadRequestError('Coupon is not yet valid');
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw new BadRequestError('Coupon usage limit reached');
    const decSubtotal = new Prisma.Decimal(subtotal);
    if (coupon.minimumAmount && decSubtotal.lt(coupon.minimumAmount)) throw new BadRequestError(`Minimum order amount of ₹${coupon.minimumAmount} required`);

    let discount = new Prisma.Decimal(0);
    if (coupon.type === 'PERCENTAGE') { discount = decSubtotal.mul(coupon.value).div(100); if (coupon.maximumDiscount && discount.gt(coupon.maximumDiscount)) discount = coupon.maximumDiscount; }
    else if (coupon.type === 'FIXED') { discount = coupon.value; }
    return { valid: true, coupon, discount: Number(discount), remainingAmount: subtotal - Number(discount) };
  },

  async delete(id: string) { const c = await prisma.coupon.findUnique({ where: { id } }); if (!c) throw new NotFoundError('Coupon not found'); await prisma.coupon.delete({ where: { id } }); },

  async autoApply(subtotal: number, context?: { categoryId?: string; vendorId?: string }) {
    const now = new Date();
    const coupons = await prisma.coupon.findMany({ where: { isActive: true, startsAt: { lte: now }, expiresAt: { gte: now } } });
    const decSubtotal = new Prisma.Decimal(subtotal);
    const available: Array<{ code: string; title: string; type: string; discount: number; description: string }> = [];
    for (const coupon of coupons) {
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) continue;
      if (coupon.minimumAmount && decSubtotal.lt(coupon.minimumAmount)) continue;
      let discount = new Prisma.Decimal(0);
      if (coupon.type === 'PERCENTAGE') { discount = decSubtotal.mul(coupon.value).div(100); if (coupon.maximumDiscount && discount.gt(coupon.maximumDiscount)) discount = coupon.maximumDiscount; }
      else if (coupon.type === 'FIXED') { discount = coupon.value; }
      if (discount.gt(0)) { available.push({ code: coupon.code, title: coupon.title, type: coupon.type, discount: Number(discount), description: `${coupon.value}% off` }); }
    }
    available.sort((a, b) => b.discount - a.discount);
    return { bestCoupon: available.length > 0 ? { ...available[0], remainingAmount: subtotal - available[0].discount } : null, availableCoupons: available.slice(0, 5) };
  },
};

export const SettlementService = {
  async generate(vendorId: string, periodStart: Date, periodEnd: Date) {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundError('Vendor not found');
    const commissions = await prisma.vendorCommission.findMany({ where: { vendorId, createdAt: { gte: periodStart, lte: periodEnd } } });
    if (commissions.length === 0) throw new BadRequestError('No commissions found in this period');

    const orderIds = commissions.map((c) => c.orderId);
    const activeReturns = await prisma.returns.findFirst({ where: { orderId: { in: orderIds }, status: { in: ['REQUESTED', 'APPROVED', 'PICKED'] } } });
    if (activeReturns) throw new BadRequestError('Cannot generate settlement: some orders have active return requests.');
    const cancelledOrders = await prisma.order.findFirst({ where: { id: { in: orderIds }, status: { in: ['CANCELLED', 'RETURNED', 'REFUNDED'] } } });
    if (cancelledOrders) throw new BadRequestError('Cannot generate settlement: some orders have been cancelled/refunded.');

    const deliveredOrderIds = (await prisma.order.findMany({ where: { id: { in: orderIds }, status: 'DELIVERED' }, select: { id: true } })).map((o) => o.id);
    const deliverableCommissions = commissions.filter((c) => deliveredOrderIds.includes(c.orderId));
    if (deliverableCommissions.length === 0) throw new BadRequestError('No delivered orders found in this period.');

    const totalSales = deliverableCommissions.reduce((sum, c) => sum.add(c.grossAmount), new Prisma.Decimal(0));
    const totalCommission = deliverableCommissions.reduce((sum, c) => sum.add(c.commissionAmount), new Prisma.Decimal(0));
    const tdsDeducted = totalSales.mul(new Prisma.Decimal(1)).div(100);
    const payableAmount = totalSales.sub(totalCommission).sub(tdsDeducted);

    return prisma.vendorSettlement.create({ data: { vendorId, periodStart, periodEnd, totalSales, commissionAmount: totalCommission, tdsDeducted, payableAmount, status: 'PENDING' } });
  },

  async listAll(filters: { page: number; limit: number; status?: string }) {
    const { page, limit, status } = filters;
    const skip = (page - 1) * limit;
    const where: Prisma.VendorSettlementWhereInput = {};
    if (status) where.status = status as SettlementStatus;
    const [settlements, total] = await Promise.all([
      prisma.vendorSettlement.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { vendor: { select: { businessName: true } } } }),
      prisma.vendorSettlement.count({ where }),
    ]);
    return { settlements, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async list(vendorId: string, filters: { page: number; limit: number; status?: string }) {
    const { page, limit, status } = filters;
    const skip = (page - 1) * limit;
    const where: Prisma.VendorSettlementWhereInput = { vendorId };
    if (status) where.status = status as SettlementStatus;
    const [settlements, total] = await Promise.all([
      prisma.vendorSettlement.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.vendorSettlement.count({ where }),
    ]);
    return { settlements, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getById(settlementId: string) {
    return prisma.vendorSettlement.findUnique({ where: { id: settlementId }, include: { vendor: { select: { businessName: true, bankAccounts: { where: { isPrimary: true }, take: 1 } } } } });
  },

  async markPaid(settlementId: string, utrNumber: string) {
    const s = await prisma.vendorSettlement.findUnique({ where: { id: settlementId } });
    if (!s) throw new NotFoundError('Settlement not found');
    if (s.status === 'PAID') throw new BadRequestError('Settlement already marked as paid');
    return prisma.vendorSettlement.update({ where: { id: settlementId }, data: { status: 'PAID', utrNumber, settledAt: new Date() } });
  },

  async getCommissions(vendorUserId: string, filters: { page: number; limit: number; orderId?: string; startDate?: string; endDate?: string }) {
    const vendor = await prisma.vendor.findUnique({ where: { userId: vendorUserId } });
    if (!vendor) throw new ForbiddenError('Vendor profile not found');
    const { page, limit, orderId, startDate, endDate } = filters;
    const skip = (page - 1) * limit;
    const where: Prisma.VendorCommissionWhereInput = { vendorId: vendor.id };
    if (orderId) where.orderId = orderId;
    if (startDate || endDate) { where.createdAt = {}; if (startDate) where.createdAt.gte = new Date(startDate); if (endDate) where.createdAt.lte = new Date(endDate); }
    const [commissions, total] = await Promise.all([
      prisma.vendorCommission.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { order: { select: { orderNumber: true, totalAmount: true } } } }),
      prisma.vendorCommission.count({ where }),
    ]);
    const summary = { totalGrossAmount: commissions.reduce((s, c) => s.add(c.grossAmount), new Prisma.Decimal(0)), totalCommissionAmount: commissions.reduce((s, c) => s.add(c.commissionAmount), new Prisma.Decimal(0)), totalNetAmount: commissions.reduce((s, c) => s.add(c.netAmount), new Prisma.Decimal(0)), count: commissions.length };
    return { commissions, summary, total, page, limit, totalPages: Math.ceil(total / limit) };
  },
};
