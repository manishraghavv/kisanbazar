import { creditWallet, debitWallet } from './wallet.ledger';
import { LEDGER_TX_OPTIONS } from '../khata/khata.ledger';
import { Prisma, PaymentMethod, PaymentStatus, SettlementStatus, WalletTransactionType } from '@prisma/client';
import { prisma } from '../../common/lib/prisma';
import { ForbiddenError, NotFoundError, ConflictError, BadRequestError, BadGatewayError } from '../../common/errors';
import { fromPaise, getGateway } from './gateway';
import { syncOrderStatus } from '../orders/orderStatus';

/** One wallet debit per order, no matter which flow (checkout, /payments/initiate, /wallet/pay) gets there first. */
export const orderWalletKey = (orderNumber: string) => `order-wallet:${orderNumber}`;

const ONLINE_METHODS: PaymentMethod[] = ['UPI', 'CARD', 'NET_BANKING'];

/** Razorpay's payment `method` -> our enum (used to record the real method once a payment is captured). */
const RAZORPAY_METHODS: Record<string, PaymentMethod> = {
  upi: 'UPI',
  card: 'CARD',
  netbanking: 'NET_BANKING',
  wallet: 'UPI',
};

type Tx = Prisma.TransactionClient;

export interface CaptureInput {
  gatewayPaymentId?: string;
  method?: string;
  rawPayload?: unknown;
  source: 'verify' | 'webhook';
}

/**
 * Marks an order's payment as received: every PENDING sub-order becomes CONFIRMED and the parent order status is
 * re-derived from them. (A cancelled sub-order stays cancelled.)
 */
async function confirmOrder(tx: Tx, orderId: string, changedBy: string, remarks: string): Promise<void> {
  const pending = await tx.subOrder.findMany({ where: { orderId, status: 'PENDING' }, select: { id: true } });
  if (pending.length > 0) {
    await tx.subOrder.updateMany({ where: { orderId, status: 'PENDING' }, data: { status: 'CONFIRMED' } });
    await tx.orderStatusHistory.createMany({
      data: pending.map((s) => ({
        orderId,
        subOrderId: s.id,
        oldStatus: 'PENDING' as const,
        newStatus: 'CONFIRMED' as const,
        changedBy,
        remarks,
      })),
    });
  }
  await syncOrderStatus(tx, orderId, changedBy, remarks);
}
export { confirmOrder };

/** Locks a payment row for the rest of the transaction and returns it fresh. */
async function lockPayment(tx: Tx, paymentId: string) {
  await tx.$queryRaw`SELECT "id" FROM "payments" WHERE "id" = ${paymentId} FOR UPDATE`;
  return tx.payment.findUnique({ where: { id: paymentId } });
}

/**
 * The single place a gateway payment becomes SUCCESS. Called by both the browser verify call and the webhook;
 * the payment row lock plus the status check make the second caller a no-op, so money is applied exactly once.
 */
export async function applyCapture(
  tx: Tx,
  paymentId: string,
  input: CaptureInput,
): Promise<{ applied: boolean; refundNeeded?: boolean }> {
  const payment = await lockPayment(tx, paymentId);
  if (!payment) throw new NotFoundError('Payment not found');
  if (payment.status === 'SUCCESS' || payment.status === 'REFUNDED' || payment.status === 'PARTIALLY_REFUNDED') {
    return { applied: false };
  }

  const method = input.method ? RAZORPAY_METHODS[input.method] : undefined;
  await tx.payment.update({
    where: { id: payment.id },
    data: {
      status: 'SUCCESS',
      gatewayPaymentId: input.gatewayPaymentId ?? payment.gatewayPaymentId,
      transactionId: input.gatewayPaymentId ?? payment.transactionId,
      paidAt: new Date(),
      ...(method ? { paymentMethod: method } : {}),
      ...(input.rawPayload ? { webhookPayload: input.rawPayload as Prisma.InputJsonValue } : {}),
    },
  });

  if (payment.purpose === 'WALLET_TOPUP') {
    if (!payment.userId) throw new BadRequestError('Top-up payment has no owner');
    // Idempotent on the payment id: verify + webhook can both arrive and the wallet is credited once.
    await creditWallet(tx, payment.userId, payment.amount, {
      remarks: 'Wallet top-up',
      referenceId: payment.id,
      idempotencyKey: `topup:${payment.id}`,
    });
  } else if (payment.orderId) {
    await confirmOrder(
      tx,
      payment.orderId,
      input.source === 'webhook' ? 'system:webhook' : (payment.userId ?? 'system'),
      input.source === 'webhook' ? 'Payment captured (verified webhook)' : 'Payment verified',
    );
    // Money arrived for an order that was cancelled meanwhile: the caller must refund it after this commits.
    const order = await tx.order.findUnique({ where: { id: payment.orderId }, select: { status: true } });
    if (order?.status === 'CANCELLED') return { applied: true, refundNeeded: true };
  }
  return { applied: true };
}

export const PaymentService = {
  /**
   * Starts a payment for an order. Online methods create a gateway order (the browser then opens Checkout.js with
   * the returned details); COD records an expected cash payment; WALLET pays immediately and idempotently.
   */
  async initiate(userId: string, data: { orderId: string; paymentMethod: string }) {
    const order = await prisma.order.findUnique({ where: { id: data.orderId } });
    if (!order) throw new NotFoundError('Order not found');
    if (order.userId !== userId) throw new ForbiddenError('Access denied');
    if (order.status !== 'PENDING' && order.status !== 'CONFIRMED') {
      throw new BadRequestError(`Cannot pay for an order in ${order.status} status`);
    }
    if (order.paymentMethod === 'KHATA_CREDIT') throw new BadRequestError('Khata orders are settled at checkout');

    const paid = await prisma.payment.findFirst({ where: { orderId: order.id, status: 'SUCCESS' } });
    if (paid) {
      if (paid.paymentMethod === 'WALLET' && data.paymentMethod === 'WALLET') {
        return { payment: paid, message: 'Order already paid from wallet' };
      }
      throw new BadRequestError('Order already has a successful payment');
    }

    const method = data.paymentMethod as PaymentMethod;
    if (method === 'WALLET') return PaymentService.payOrderWithWallet(userId, order.id);

    if (method === 'COD') {
      const existing = await prisma.payment.findFirst({ where: { orderId: order.id, paymentMethod: 'COD' } });
      const payment =
        existing ??
        (await prisma.payment.create({
          data: {
            orderId: order.id,
            userId,
            amount: order.totalAmount,
            currency: 'INR',
            paymentMethod: 'COD',
            gateway: 'cod',
            status: 'PENDING',
            idempotencyKey: `cod:${order.orderNumber}`,
          },
        }));
      return { payment, message: 'COD payment recorded. Amount will be collected on delivery.' };
    }
    if (!ONLINE_METHODS.includes(method)) throw new BadRequestError('Unsupported payment method');

    // Reuse an open gateway order so refreshing the page does not pile up orders at the gateway.
    const open = await prisma.payment.findFirst({
      where: { orderId: order.id, status: 'PENDING', gatewayOrderId: { not: null }, amount: order.totalAmount },
      orderBy: { createdAt: 'desc' },
    });
    const gateway = getGateway();
    if (open) {
      return {
        payment: open,
        gateway: checkoutDetails(open.gatewayOrderId!, open.amount, open.currency),
      };
    }

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        userId,
        amount: order.totalAmount,
        currency: 'INR',
        paymentMethod: method,
        gateway: gateway.name,
        status: 'PENDING',
      },
    });
    return PaymentService.createGatewayOrder(payment.id, order.orderNumber);
  },

  /** Creates the gateway-side order for a PENDING payment and returns what Checkout.js needs. */
  async createGatewayOrder(paymentId: string, receipt: string) {
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const gateway = getGateway();
    try {
      const gwOrder = await gateway.createOrder({
        amount: payment.amount,
        currency: payment.currency,
        receipt: receipt.slice(0, 40),
        notes: {
          paymentId: payment.id,
          purpose: payment.purpose,
          ...(payment.orderId ? { orderId: payment.orderId } : {}),
        },
      });
      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: { gatewayOrderId: gwOrder.gatewayOrderId, transactionId: gwOrder.gatewayOrderId, gateway: gateway.name },
      });
      return { payment: updated, gateway: checkoutDetails(gwOrder.gatewayOrderId, payment.amount, payment.currency) };
    } catch (err) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
      console.error('[PAYMENTS] gateway order creation failed:', (err as Error).message);
      throw new BadGatewayError('Payment gateway error. Please try again.');
    }
  },

  /**
   * Browser callback after Checkout.js succeeds. The signature proves the gateway issued this payment id for
   * OUR gateway order; the amount was fixed when we created that order. The webhook later confirms (idempotently).
   */
  async verify(
    userId: string,
    data: { paymentId: string; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
  ) {
    const payment = await prisma.payment.findUnique({ where: { id: data.paymentId } });
    if (!payment || payment.userId !== userId) throw new NotFoundError('Payment not found');
    if (payment.status === 'SUCCESS') return { payment, message: 'Payment already verified' };
    if (payment.status !== 'PENDING' && payment.status !== 'FAILED') {
      throw new BadRequestError(`Payment is ${payment.status}`);
    }
    if (!payment.gatewayOrderId || payment.gatewayOrderId !== data.razorpay_order_id) {
      throw new BadRequestError('Payment does not match this gateway order');
    }
    const ok = getGateway().verifyCheckoutSignature({
      gatewayOrderId: data.razorpay_order_id,
      gatewayPaymentId: data.razorpay_payment_id,
      signature: data.razorpay_signature,
    });
    if (!ok) throw new BadRequestError('Payment verification failed');

    let outcome: { applied: boolean; refundNeeded?: boolean };
    try {
      outcome = await prisma.$transaction(
        (tx) => applyCapture(tx, payment.id, { gatewayPaymentId: data.razorpay_payment_id, source: 'verify' }),
        LEDGER_TX_OPTIONS,
      );
    } catch (err) {
      // unique(gatewayPaymentId): that gateway payment already confirmed a different payment row.
      if ((err as { code?: string }).code === 'P2002') throw new ConflictError('This gateway payment was already used');
      throw err;
    }
    if (outcome.refundNeeded) {
      await RefundService.refundPayment({
        paymentId: payment.id,
        reason: 'Order was cancelled before the payment arrived',
        idempotencyKey: `late-capture:${payment.id}`,
      }).catch((err) => console.error('[PAYMENTS] auto-refund of a late capture failed:', (err as Error).message));
    }
    const fresh = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    return { payment: fresh, message: 'Payment verified successfully' };
  },

  /**
   * Pays an order from the wallet. Idempotent across every flow: the wallet debit uses the per-order key, the
   * order row is locked, and an existing SUCCESS payment short-circuits, so the wallet is charged at most once.
   */
  async payOrderWithWallet(userId: string, orderId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundError('Order not found');
      if (order.userId !== userId) throw new ForbiddenError('Access denied');
      if (order.status !== 'PENDING' && order.status !== 'CONFIRMED') {
        throw new BadRequestError(`Cannot pay for an order in ${order.status} status`);
      }

      const existing = await tx.payment.findFirst({ where: { orderId, status: 'SUCCESS' } });
      if (existing) {
        if (existing.paymentMethod !== 'WALLET') throw new BadRequestError('Order already has a successful payment');
        return { payment: existing, message: 'Order already paid from wallet' };
      }

      await debitWallet(tx, userId, order.totalAmount, {
        remarks: `Order ${order.orderNumber} — held until delivery`,
        referenceId: order.id,
        idempotencyKey: orderWalletKey(order.orderNumber),
      });
      const payment = await tx.payment.upsert({
        where: { idempotencyKey: orderWalletKey(order.orderNumber) },
        update: { status: 'SUCCESS', paidAt: new Date() },
        create: {
          orderId: order.id,
          userId,
          amount: order.totalAmount,
          currency: 'INR',
          paymentMethod: 'WALLET',
          gateway: 'wallet',
          status: 'SUCCESS',
          paidAt: new Date(),
          idempotencyKey: orderWalletKey(order.orderNumber),
        },
      });
      await confirmOrder(tx, order.id, userId, 'Paid via wallet');
      return { payment, message: 'Paid from wallet' };
    }, LEDGER_TX_OPTIONS);
  },

  /**
   * Webhook `payment.captured` / `order.paid`. Called only after the webhook signature was verified, inside the
   * webhook's own transaction. Unknown payments and amount mismatches are ignored, never confirmed.
   */
  async confirmCapturedPayment(
    tx: Tx,
    input: {
      paymentId?: string;
      gatewayOrderId?: string;
      gatewayPaymentId?: string;
      amountPaise: number;
      currency?: string;
      method?: string;
      rawPayload: unknown;
    },
  ): Promise<{ ignored?: string; refundPaymentId?: string }> {
    const lookup: Prisma.PaymentWhereInput[] = [];
    if (input.paymentId) lookup.push({ id: input.paymentId });
    if (input.gatewayOrderId) lookup.push({ gatewayOrderId: input.gatewayOrderId });
    if (lookup.length === 0) return { ignored: 'unknown_payment' };

    const payment = await tx.payment.findFirst({ where: { OR: lookup } });
    if (!payment) return { ignored: 'unknown_payment' };
    if (payment.gatewayOrderId && input.gatewayOrderId && payment.gatewayOrderId !== input.gatewayOrderId) {
      return { ignored: 'order_mismatch' };
    }
    if (payment.status === 'SUCCESS' || payment.status === 'REFUNDED' || payment.status === 'PARTIALLY_REFUNDED') {
      return { ignored: 'already_processed' };
    }
    if (
      !fromPaise(input.amountPaise).equals(payment.amount) ||
      (input.currency && input.currency !== payment.currency)
    ) {
      console.error(
        `[WEBHOOK] Amount/currency mismatch for payment ${payment.id}: expected ${payment.amount} ${payment.currency}, got ${fromPaise(input.amountPaise)} ${input.currency}`,
      );
      return { ignored: 'amount_mismatch' };
    }
    const { applied, refundNeeded } = await applyCapture(tx, payment.id, {
      gatewayPaymentId: input.gatewayPaymentId,
      method: input.method,
      rawPayload: input.rawPayload,
      source: 'webhook',
    });
    if (!applied) return { ignored: 'already_processed' };
    return refundNeeded ? { refundPaymentId: payment.id } : {};
  },

  /** Webhook `payment.failed`: only an unpaid payment can fail; the order stays PENDING so the customer can retry. */
  async markPaymentFailed(
    tx: Tx,
    input: { paymentId?: string; gatewayOrderId?: string; rawPayload: unknown },
  ): Promise<{ ignored?: string }> {
    const lookup: Prisma.PaymentWhereInput[] = [];
    if (input.paymentId) lookup.push({ id: input.paymentId });
    if (input.gatewayOrderId) lookup.push({ gatewayOrderId: input.gatewayOrderId });
    if (lookup.length === 0) return { ignored: 'unknown_payment' };
    const updated = await tx.payment.updateMany({
      where: { OR: lookup, status: 'PENDING' },
      data: { status: 'FAILED', webhookPayload: input.rawPayload as Prisma.InputJsonValue },
    });
    return updated.count > 0 ? {} : { ignored: 'not_pending' };
  },

  /** Webhook `refund.processed` / `refund.failed`: finalises a refund we started (or records an unknown one). */
  async finalizeRefund(tx: Tx, input: { gatewayRefundId: string; failed?: boolean }): Promise<{ ignored?: string }> {
    const refund = await tx.refunds.findUnique({ where: { gatewayRefundId: input.gatewayRefundId } });
    if (!refund) return { ignored: 'unknown_refund' };
    if (refund.status === 'PROCESSED' || refund.status === 'FAILED') return { ignored: 'already_processed' };
    await tx.refunds.update({
      where: { id: refund.id },
      data: input.failed ? { status: 'FAILED' } : { status: 'PROCESSED', processedAt: new Date() },
    });
    if (refund.paymentId) await syncPaymentRefundStatus(tx, refund.paymentId);
    return {};
  },

  async getPayment(paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: { select: { id: true, orderNumber: true, totalAmount: true, status: true } }, refunds: true },
    });
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
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { order: { select: { orderNumber: true } } },
      }),
      prisma.payment.count({ where }),
    ]);
    return { payments, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async processRefund(paymentId: string, data: { amount?: number; reason?: string; idempotencyKey?: string }) {
    const result = await RefundService.refundPayment({
      paymentId,
      amount: data.amount !== undefined ? new Prisma.Decimal(data.amount) : undefined,
      reason: data.reason,
      idempotencyKey: data.idempotencyKey,
    });
    return {
      message: `Refund of ₹${result.refund.amount} ${result.refund.status === 'PROCESSED' ? 'processed' : 'initiated'}`,
      gatewayRefundId: result.refund.gatewayRefundId,
      refund: result.refund,
    };
  },
};

function checkoutDetails(gatewayOrderId: string, amount: Prisma.Decimal, currency: string) {
  const gateway = getGateway();
  return {
    name: gateway.name,
    keyId: gateway.publicKeyId,
    gatewayOrderId,
    amountPaise: amount.mul(100).toDecimalPlaces(0).toNumber(),
    currency,
  };
}

/** Recomputes a payment's REFUNDED / PARTIALLY_REFUNDED status from its refunds. */
async function syncPaymentRefundStatus(tx: Tx, paymentId: string): Promise<void> {
  const payment = await tx.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return;
  const agg = await tx.refunds.aggregate({
    where: { paymentId, status: { in: ['PROCESSED', 'PENDING'] } },
    _sum: { amount: true },
  });
  const refunded = agg._sum.amount ?? new Prisma.Decimal(0);
  if (refunded.lte(0)) return;
  const status: PaymentStatus = refunded.gte(payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
  if (payment.status !== status) await tx.payment.update({ where: { id: paymentId }, data: { status } });
}

export const RefundService = {
  /**
   * Refunds (part of) a successful payment back to where the money came from:
   *   online -> the gateway (Razorpay refund, finalised by the refund.processed webhook if it is still pending)
   *   wallet -> the wallet, COD -> recorded for manual cash settlement.
   * Total refunds can never exceed the payment amount. Repeating a call with the same idempotency key is a no-op.
   */
  async refundPayment(input: {
    paymentId: string;
    amount?: Prisma.Decimal;
    reason?: string;
    idempotencyKey?: string;
    orderItemId?: string;
  }) {
    // Step 1 (short DB transaction): validate against what was already refunded and reserve the refund row.
    const reserved = await prisma.$transaction(async (tx) => {
      const payment = await lockPayment(tx, input.paymentId);
      if (!payment) throw new NotFoundError('Payment not found');

      // A repeated key replays the earlier refund. A refund that FAILED at the gateway is retried on the same row
      // (the key is unique), after re-checking that the amount is still refundable.
      let retryOf: { id: string; amount: Prisma.Decimal } | null = null;
      if (input.idempotencyKey) {
        const prior = await tx.refunds.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (prior && prior.status !== 'FAILED') return { payment, refund: prior, replay: true };
        if (prior) retryOf = prior;
      }
      // COD cash is collected at the door, so a COD payment is refundable while still recorded as PENDING.
      const refundable =
        payment.status === 'SUCCESS' ||
        payment.status === 'PARTIALLY_REFUNDED' ||
        (payment.paymentMethod === 'COD' && payment.status === 'PENDING');
      if (!refundable) throw new BadRequestError('Can only refund successful payments');
      const agg = await tx.refunds.aggregate({
        where: { paymentId: payment.id, status: { in: ['PROCESSED', 'PENDING'] } },
        _sum: { amount: true },
      });
      const remaining = payment.amount.sub(agg._sum.amount ?? 0);
      const amount = (input.amount ?? remaining).toDecimalPlaces(2);
      if (!amount.gt(0)) throw new BadRequestError('Nothing left to refund');
      if (amount.gt(remaining)) throw new BadRequestError(`Refund exceeds the refundable amount of ₹${remaining}`);

      const refund = retryOf
        ? await tx.refunds.update({
            where: { id: retryOf.id },
            data: { amount, status: 'PENDING', reason: input.reason },
          })
        : await tx.refunds.create({
            data: {
              orderId: payment.orderId!,
              paymentId: payment.id,
              orderItemId: input.orderItemId,
              amount,
              reason: input.reason,
              status: 'PENDING',
              idempotencyKey: input.idempotencyKey,
            },
          });
      return { payment, refund, replay: false };
    }, LEDGER_TX_OPTIONS);

    if (reserved.replay) return { refund: reserved.refund };
    const { payment, refund } = reserved;

    // Step 2: move the money. Network calls happen outside any DB transaction.
    let gatewayRefundId: string | null = null;
    let finalStatus: 'PROCESSED' | 'PENDING' = 'PROCESSED';
    try {
      if (payment.paymentMethod === 'WALLET' || payment.paymentMethod === 'COD') {
        // Wallet payments go back to the wallet; so do COD refunds (cash cannot be sent back electronically).
        await prisma.$transaction(async (tx) => {
          await creditWallet(tx, payment.userId!, refund.amount, {
            remarks: `Refund for order payment ${payment.id}`,
            referenceId: payment.orderId ?? undefined,
            idempotencyKey: `refund-wallet:${refund.id}`,
          });
        }, LEDGER_TX_OPTIONS);
      } else if (payment.gatewayPaymentId) {
        const result = await getGateway().refund({
          gatewayPaymentId: payment.gatewayPaymentId,
          amount: refund.amount,
          receipt: refund.id,
          notes: { refundId: refund.id, paymentId: payment.id },
        });
        gatewayRefundId = result.gatewayRefundId;
        finalStatus = result.status === 'processed' ? 'PROCESSED' : 'PENDING';
      }
      // COD / cash: nothing to move electronically; the record is the instruction for manual settlement.
    } catch (err) {
      await prisma.refunds.update({ where: { id: refund.id }, data: { status: 'FAILED' } });
      console.error('[PAYMENTS] refund failed:', (err as Error).message);
      throw new BadGatewayError('Refund could not be processed. Please try again.');
    }

    const done = await prisma.$transaction(async (tx) => {
      const updated = await tx.refunds.update({
        where: { id: refund.id },
        data: {
          status: finalStatus,
          gatewayRefundId,
          processedAt: finalStatus === 'PROCESSED' ? new Date() : null,
        },
      });
      await syncPaymentRefundStatus(tx, payment.id);
      return updated;
    });
    return { refund: done };
  },
};

export const WalletService = {
  async getWallet(userId: string) {
    let wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: { _count: { select: { transactions: true } } },
    });
    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: { userId },
        include: { _count: { select: { transactions: true } } },
      });
    }
    return wallet;
  },

  async getBalance(userId: string) {
    const wallet = await WalletService.getWallet(userId);
    return { balance: wallet.balance, walletId: wallet.id };
  },

  /**
   * Starts a wallet top-up. The wallet is NOT credited here: it is credited only when the gateway payment is
   * verified (browser verify call or webhook), by `applyCapture`. There is no other credit path.
   */
  async startTopUp(userId: string, amount: number) {
    const decimal = new Prisma.Decimal(amount).toDecimalPlaces(2);
    if (!decimal.gt(0)) throw new BadRequestError('Amount must be greater than zero');
    const payment = await prisma.payment.create({
      data: {
        userId,
        purpose: 'WALLET_TOPUP',
        amount: decimal,
        currency: 'INR',
        paymentMethod: 'UPI', // replaced with the real method when the payment is captured
        gateway: getGateway().name,
        status: 'PENDING',
      },
    });
    return PaymentService.createGatewayOrder(payment.id, `topup-${payment.id.slice(0, 8)}`);
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

  /** `/wallet/pay`: same single-debit path as checkout and /payments/initiate; the client amount must match. */
  async useForPayment(userId: string, orderId: string, amount?: number) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError('Order not found');
    if (order.userId !== userId) throw new ForbiddenError('Access denied');
    if (amount !== undefined && !order.totalAmount.equals(new Prisma.Decimal(amount))) {
      throw new BadRequestError('Amount does not match the order total');
    }
    return PaymentService.payOrderWithWallet(userId, orderId);
  },
};

export const CouponService = {
  async create(data: {
    code: string;
    title: string;
    type: string;
    value: number;
    minimumAmount?: number;
    maximumDiscount?: number;
    usageLimit?: number;
    perUserLimit?: number;
    applicableTo?: string;
    startsAt: Date;
    expiresAt: Date;
    isActive?: boolean;
  }) {
    const existing = await prisma.coupon.findUnique({ where: { code: data.code } });
    if (existing) throw new ConflictError(`Coupon code "${data.code}" already exists`);
    return prisma.coupon.create({
      data: {
        code: data.code,
        title: data.title,
        type: data.type as any,
        value: new Prisma.Decimal(data.value),
        minimumAmount: data.minimumAmount ? new Prisma.Decimal(data.minimumAmount) : undefined,
        maximumDiscount: data.maximumDiscount ? new Prisma.Decimal(data.maximumDiscount) : undefined,
        usageLimit: data.usageLimit,
        perUserLimit: data.perUserLimit ?? 1,
        applicableTo: data.applicableTo ?? 'ALL',
        startsAt: data.startsAt,
        expiresAt: data.expiresAt,
        isActive: data.isActive ?? true,
      },
    });
  },

  async update(id: string, data: any) {
    const coupon = await prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundError('Coupon not found');
    const updateData: Prisma.CouponUpdateInput = {};
    for (const field of [
      'title',
      'type',
      'usageLimit',
      'perUserLimit',
      'applicableTo',
      'startsAt',
      'expiresAt',
      'isActive',
    ]) {
      if (data[field] !== undefined) (updateData as any)[field] = data[field];
    }
    for (const field of ['value', 'minimumAmount', 'maximumDiscount']) {
      if (data[field] !== undefined) (updateData as any)[field] = new Prisma.Decimal(data[field]);
    }
    return prisma.coupon.update({ where: { id }, data: updateData });
  },

  async getById(id: string) {
    return prisma.coupon.findUnique({ where: { id } });
  },

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
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)
      throw new BadRequestError('Coupon usage limit reached');
    const decSubtotal = new Prisma.Decimal(subtotal);
    if (coupon.minimumAmount && decSubtotal.lt(coupon.minimumAmount))
      throw new BadRequestError(`Minimum order amount of ₹${coupon.minimumAmount} required`);

    let discount = new Prisma.Decimal(0);
    if (coupon.type === 'PERCENTAGE') {
      discount = decSubtotal.mul(coupon.value).div(100);
      if (coupon.maximumDiscount && discount.gt(coupon.maximumDiscount)) discount = coupon.maximumDiscount;
    } else if (coupon.type === 'FIXED') {
      discount = coupon.value;
    }
    return { valid: true, coupon, discount: Number(discount), remainingAmount: subtotal - Number(discount) };
  },

  async delete(id: string) {
    const c = await prisma.coupon.findUnique({ where: { id } });
    if (!c) throw new NotFoundError('Coupon not found');
    await prisma.coupon.delete({ where: { id } });
  },

  async autoApply(subtotal: number, context?: { categoryId?: string; vendorId?: string }) {
    const now = new Date();
    const coupons = await prisma.coupon.findMany({
      where: { isActive: true, startsAt: { lte: now }, expiresAt: { gte: now } },
    });
    const decSubtotal = new Prisma.Decimal(subtotal);
    const available: Array<{ code: string; title: string; type: string; discount: number; description: string }> = [];
    for (const coupon of coupons) {
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) continue;
      if (coupon.minimumAmount && decSubtotal.lt(coupon.minimumAmount)) continue;
      let discount = new Prisma.Decimal(0);
      if (coupon.type === 'PERCENTAGE') {
        discount = decSubtotal.mul(coupon.value).div(100);
        if (coupon.maximumDiscount && discount.gt(coupon.maximumDiscount)) discount = coupon.maximumDiscount;
      } else if (coupon.type === 'FIXED') {
        discount = coupon.value;
      }
      if (discount.gt(0)) {
        available.push({
          code: coupon.code,
          title: coupon.title,
          type: coupon.type,
          discount: Number(discount),
          description: `${coupon.value}% off`,
        });
      }
    }
    available.sort((a, b) => b.discount - a.discount);
    return {
      bestCoupon: available.length > 0 ? { ...available[0], remainingAmount: subtotal - available[0].discount } : null,
      availableCoupons: available.slice(0, 5),
    };
  },
};

export const SettlementService = {
  async generate(vendorId: string, periodStart: Date, periodEnd: Date) {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundError('Vendor not found');
    const commissions = await prisma.vendorCommission.findMany({
      where: { vendorId, createdAt: { gte: periodStart, lte: periodEnd } },
    });
    if (commissions.length === 0) throw new BadRequestError('No commissions found in this period');

    // Settlement works per SUB-ORDER: only this vendor's delivered sub-orders earn money, and another vendor's
    // cancellation or return never blocks it. (A cancelled sub-order's commission row is deleted at cancellation.)
    const subOrderIds = commissions.map((c) => c.subOrderId);
    const activeReturns = await prisma.returns.findFirst({
      where: { subOrderId: { in: subOrderIds }, status: { in: ['REQUESTED', 'APPROVED', 'RECEIVED'] } },
    });
    if (activeReturns)
      throw new BadRequestError('Cannot generate settlement: some orders have active return requests.');

    const deliveredSubOrderIds = new Set(
      (
        await prisma.subOrder.findMany({
          where: { id: { in: subOrderIds }, status: 'DELIVERED' },
          select: { id: true },
        })
      ).map((o) => o.id),
    );
    const deliverableCommissions = commissions.filter((c) => deliveredSubOrderIds.has(c.subOrderId));
    if (deliverableCommissions.length === 0) throw new BadRequestError('No delivered orders found in this period.');

    const totalSales = deliverableCommissions.reduce((sum, c) => sum.add(c.grossAmount), new Prisma.Decimal(0));
    const totalCommission = deliverableCommissions.reduce(
      (sum, c) => sum.add(c.commissionAmount),
      new Prisma.Decimal(0),
    );
    const tdsDeducted = totalSales.mul(new Prisma.Decimal(1)).div(100);
    const payableAmount = totalSales.sub(totalCommission).sub(tdsDeducted);

    return prisma.vendorSettlement.create({
      data: {
        vendorId,
        periodStart,
        periodEnd,
        totalSales,
        commissionAmount: totalCommission,
        tdsDeducted,
        payableAmount,
        status: 'PENDING',
      },
    });
  },

  async listAll(filters: { page: number; limit: number; status?: string }) {
    const { page, limit, status } = filters;
    const skip = (page - 1) * limit;
    const where: Prisma.VendorSettlementWhereInput = {};
    if (status) where.status = status as SettlementStatus;
    const [settlements, total] = await Promise.all([
      prisma.vendorSettlement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { vendor: { select: { businessName: true } } },
      }),
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
    return prisma.vendorSettlement.findUnique({
      where: { id: settlementId },
      include: { vendor: { select: { businessName: true, bankAccounts: { where: { isPrimary: true }, take: 1 } } } },
    });
  },

  async markPaid(settlementId: string, utrNumber: string) {
    const s = await prisma.vendorSettlement.findUnique({ where: { id: settlementId } });
    if (!s) throw new NotFoundError('Settlement not found');
    if (s.status === 'PAID') throw new BadRequestError('Settlement already marked as paid');
    return prisma.vendorSettlement.update({
      where: { id: settlementId },
      data: { status: 'PAID', utrNumber, settledAt: new Date() },
    });
  },

  async getCommissions(
    vendorUserId: string,
    filters: { page: number; limit: number; orderId?: string; startDate?: string; endDate?: string },
  ) {
    const vendor = await prisma.vendor.findUnique({ where: { userId: vendorUserId } });
    if (!vendor) throw new ForbiddenError('Vendor profile not found');
    const { page, limit, orderId, startDate, endDate } = filters;
    const skip = (page - 1) * limit;
    const where: Prisma.VendorCommissionWhereInput = { vendorId: vendor.id };
    if (orderId) where.orderId = orderId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    const [commissions, total] = await Promise.all([
      prisma.vendorCommission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { order: { select: { orderNumber: true, totalAmount: true } } },
      }),
      prisma.vendorCommission.count({ where }),
    ]);
    const summary = {
      totalGrossAmount: commissions.reduce((s, c) => s.add(c.grossAmount), new Prisma.Decimal(0)),
      totalCommissionAmount: commissions.reduce((s, c) => s.add(c.commissionAmount), new Prisma.Decimal(0)),
      totalNetAmount: commissions.reduce((s, c) => s.add(c.netAmount), new Prisma.Decimal(0)),
      count: commissions.length,
    };
    return { commissions, summary, total, page, limit, totalPages: Math.ceil(total / limit) };
  },
};
