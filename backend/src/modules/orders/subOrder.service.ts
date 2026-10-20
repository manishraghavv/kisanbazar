import { OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '../../common/lib/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/errors';
import { LEDGER_TX_OPTIONS, postKhataEntry } from '../khata/khata.ledger';
import { creditWallet } from '../payments/wallet.ledger';
import { RefundService } from '../payments/payment.service';
import { issueTaxInvoice } from './invoice.service';
import { CUSTOMER_CANCELLABLE, canVendorTransition, syncOrderStatus } from './orderStatus';

/**
 * Everything a vendor or customer does to ONE vendor's slice of an order.
 *
 * Authorisation is always against the sub-order's vendor: a vendor can read and change only their own sub-orders,
 * a customer only the sub-orders of their own orders, and admins everything.
 */

export interface Actor {
  id: string;
  role: string;
}

const ONLINE_METHODS = ['UPI', 'CARD', 'NET_BANKING'];

async function vendorIdOf(user: Actor): Promise<string | null> {
  if (user.role !== 'VENDOR') return null;
  const vendor = await prisma.vendor.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!vendor) throw new ForbiddenError('Vendor profile not found');
  return vendor.id;
}

/** Loads a sub-order the actor may act on as its seller (or admin). */
export async function loadSubOrderForSeller(subOrderId: string, actor: Actor) {
  const so = await prisma.subOrder.findUnique({
    where: { id: subOrderId },
    include: { order: true, vendor: { select: { userId: true } } },
  });
  if (!so) throw new NotFoundError('Sub-order not found');
  if (actor.role === 'ADMIN') return so;
  if (actor.role === 'VENDOR' && so.vendor.userId === actor.id) return so;
  throw new ForbiddenError('This sub-order belongs to another seller');
}

export const SUB_ORDER_INCLUDE = {
  vendor: { select: { id: true, businessName: true, gstNumber: true, stateCode: true } },
  items: {
    include: {
      variant: {
        select: {
          id: true,
          sku: true,
          variantName: true,
          product: {
            select: { id: true, name: true, slug: true, images: { take: 1, orderBy: { sortOrder: 'asc' as const } } },
          },
        },
      },
    },
  },
  shipments: { include: { events: { orderBy: { eventTime: 'desc' as const } } } },
  invoices: {
    select: { id: true, invoiceNumber: true, type: true, issuedAt: true, totalAmount: true },
    orderBy: { issuedAt: 'asc' as const },
  },
  returns: { include: { items: true }, orderBy: { createdAt: 'desc' as const } },
} satisfies Prisma.SubOrderInclude;

interface CancelEffects {
  refund?: { paymentId: string; amount: Prisma.Decimal; key: string };
}

/**
 * Cancels one sub-order inside the caller's transaction: conditional status transition (two concurrent cancels =>
 * exactly one wins), stock back, commission dropped, khata credit reversed with a reversing ledger entry, parent
 * status re-derived. Money that went through a payment is refunded AFTER commit (see `refundAfterCancel`).
 */
async function cancelInTx(
  tx: Prisma.TransactionClient,
  subOrderId: string,
  allowedFrom: readonly OrderStatus[],
  actorId: string,
  reason: string,
): Promise<CancelEffects> {
  const so = await tx.subOrder.findUniqueOrThrow({
    where: { id: subOrderId },
    include: { items: true, order: true },
  });
  const moved = await tx.subOrder.updateMany({
    where: { id: subOrderId, status: { in: [...allowedFrom] } },
    data: { status: 'CANCELLED', cancellationReason: reason },
  });
  if (moved.count === 0) throw new BadRequestError('This sub-order can no longer be cancelled');

  for (const item of [...so.items].sort((a, b) => a.variantId.localeCompare(b.variantId))) {
    await tx.productVariant.update({
      where: { id: item.variantId },
      data: { stockQuantity: { increment: item.quantity } },
    });
    await tx.inventory.create({
      data: {
        variantId: item.variantId,
        quantityChange: item.quantity,
        reason: 'RESTOCK',
        referenceId: so.subOrderNumber,
        performedById: actorId,
      },
    });
  }
  await tx.vendorCommission.deleteMany({ where: { subOrderId } });
  await tx.orderStatusHistory.create({
    data: {
      orderId: so.orderId,
      subOrderId,
      oldStatus: so.status,
      newStatus: 'CANCELLED',
      changedBy: actorId,
      remarks: reason,
    },
  });

  const effects: CancelEffects = {};
  if (so.order.paymentMethod === 'KHATA_CREDIT' && so.khataAccountId && so.totalAmount.gt(0)) {
    // Reversing entry; clamped to what is still owed. Anything the farmer had already repaid goes to their wallet.
    const result = await postKhataEntry(tx, {
      accountId: so.khataAccountId,
      type: 'WAIVER',
      amount: so.totalAmount,
      performedById: actorId,
      linkedOrderId: so.orderId,
      remarks: `Sub-order ${so.subOrderNumber} cancelled — credit reversed`,
      idempotencyKey: `suborder-cancel:${so.subOrderNumber}`,
      allowedStatuses: ['ACTIVE', 'OVERDUE', 'SETTLED', 'SUSPENDED', 'WRITTEN_OFF'],
      clampCredit: true,
    });
    const applied = result.transaction ? result.transaction.amount : new Prisma.Decimal(0);
    const excess = so.totalAmount.sub(applied);
    if (excess.gt(0)) {
      await creditWallet(tx, so.order.userId, excess, {
        remarks: `Refund for cancelled ${so.subOrderNumber} (credit already repaid)`,
        referenceId: so.orderId,
        idempotencyKey: `suborder-cancel-excess:${so.subOrderNumber}`,
      });
    }
  } else if (so.order.paymentMethod !== 'COD') {
    const payment = await tx.payment.findFirst({
      where: { orderId: so.orderId, status: { in: ['SUCCESS', 'PARTIALLY_REFUNDED'] } },
      orderBy: { createdAt: 'asc' },
    });
    if (payment) effects.refund = { paymentId: payment.id, amount: so.totalAmount, key: `cancel:${so.subOrderNumber}` };
  }

  await syncOrderStatus(tx, so.orderId, actorId, reason);
  return effects;
}

/** Refunds a cancelled sub-order's share of a paid order (gateway or wallet). Never throws: failures are logged. */
async function refundAfterCancel(effects: CancelEffects, reason: string): Promise<'REFUNDED' | 'FAILED' | 'NONE'> {
  if (!effects.refund) return 'NONE';
  try {
    await RefundService.refundPayment({
      paymentId: effects.refund.paymentId,
      amount: effects.refund.amount,
      reason,
      idempotencyKey: effects.refund.key,
    });
    return 'REFUNDED';
  } catch (err) {
    console.error('[ORDERS] refund after cancellation failed (needs attention):', (err as Error).message);
    return 'FAILED';
  }
}

export const SubOrderService = {
  /** Vendor's own sub-orders (newest first). Admins may filter by vendor. */
  async list(actor: Actor, filters: { page: number; limit: number; status?: string; vendorId?: string }) {
    const where: Prisma.SubOrderWhereInput = {};
    if (actor.role === 'VENDOR') where.vendorId = (await vendorIdOf(actor))!;
    else if (actor.role === 'ADMIN') {
      if (filters.vendorId) where.vendorId = filters.vendorId;
    } else {
      where.order = { userId: actor.id };
    }
    if (filters.status) where.status = filters.status as OrderStatus;
    const skip = (filters.page - 1) * filters.limit;
    const [subOrders, total] = await Promise.all([
      prisma.subOrder.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ...SUB_ORDER_INCLUDE,
          order: {
            select: {
              id: true,
              orderNumber: true,
              paymentMethod: true,
              createdAt: true,
              user: { select: { id: true, fullName: true, phoneNumber: true } },
              address: true,
            },
          },
        },
      }),
      prisma.subOrder.count({ where }),
    ]);
    return { subOrders, total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) };
  },

  async getById(subOrderId: string, actor: Actor) {
    const so = await prisma.subOrder.findUnique({
      where: { id: subOrderId },
      include: {
        ...SUB_ORDER_INCLUDE,
        order: {
          select: {
            id: true,
            orderNumber: true,
            userId: true,
            paymentMethod: true,
            createdAt: true,
            user: { select: { id: true, fullName: true, phoneNumber: true } },
            address: true,
          },
        },
      },
    });
    if (!so) throw new NotFoundError('Sub-order not found');
    if (actor.role === 'ADMIN' || so.order.userId === actor.id) return so;
    if (actor.role === 'VENDOR') {
      const vendor = await prisma.vendor.findUnique({ where: { userId: actor.id }, select: { id: true } });
      if (vendor && vendor.id === so.vendorId) return so;
    }
    throw new ForbiddenError('Access denied');
  },

  /** Vendor (own sub-order) or admin moves a sub-order along the fulfilment chain, or rejects/cancels it. */
  async updateStatus(actor: Actor, subOrderId: string, data: { status: string; remarks?: string }) {
    const so = await loadSubOrderForSeller(subOrderId, actor);
    const to = data.status as OrderStatus;
    if (!canVendorTransition(so.status, to)) {
      throw new BadRequestError(`Cannot transition from ${so.status} to ${to}`);
    }
    if (to === 'CANCELLED' && !data.remarks?.trim())
      throw new BadRequestError('Give a reason when rejecting or cancelling');

    if (so.status === 'PENDING' && ONLINE_METHODS.includes(so.order.paymentMethod) && to !== 'CANCELLED') {
      const paid = await prisma.payment.findFirst({ where: { orderId: so.orderId, status: 'SUCCESS' } });
      if (!paid) throw new BadRequestError("Waiting for the customer's online payment");
    }

    let effects: CancelEffects = {};
    const updated = await prisma.$transaction(async (tx) => {
      if (to === 'CANCELLED') {
        effects = await cancelInTx(
          tx,
          subOrderId,
          ['PENDING', 'CONFIRMED', 'PROCESSING'],
          actor.id,
          data.remarks!.trim(),
        );
      } else {
        const moved = await tx.subOrder.updateMany({
          where: { id: subOrderId, status: so.status },
          data: { status: to, ...(to === 'DELIVERED' ? { deliveredAt: new Date() } : {}) },
        });
        if (moved.count === 0)
          throw new BadRequestError('The sub-order changed while you were updating it; reload and retry');
        await tx.orderStatusHistory.create({
          data: {
            orderId: so.orderId,
            subOrderId,
            oldStatus: so.status,
            newStatus: to,
            changedBy: actor.id,
            remarks: data.remarks,
          },
        });
        // Goods leave the seller's premises: that is the time of supply, so the tax invoice is issued now.
        if (to === 'SHIPPED') await issueTaxInvoice(tx, subOrderId);
        const parent = await syncOrderStatus(tx, so.orderId, actor.id, data.remarks);
        // Cash on delivery: the money is collected once every vendor has delivered.
        if (to === 'DELIVERED' && parent === 'DELIVERED' && so.order.paymentMethod === 'COD') {
          await tx.payment.updateMany({
            where: { orderId: so.orderId, paymentMethod: 'COD', status: 'PENDING' },
            data: { status: 'SUCCESS', paidAt: new Date() },
          });
        }
      }
      return tx.subOrder.findUniqueOrThrow({ where: { id: subOrderId }, include: SUB_ORDER_INCLUDE });
    }, LEDGER_TX_OPTIONS);

    const refund = await refundAfterCancel(effects, data.remarks ?? 'Cancelled by seller');
    return { subOrder: updated, refund };
  },

  /** Customer cancels one sub-order (only while PENDING or CONFIRMED). */
  async cancelAsCustomer(userId: string, subOrderId: string, reason: string) {
    const so = await prisma.subOrder.findUnique({ where: { id: subOrderId }, include: { order: true } });
    if (!so || so.order.userId !== userId) throw new NotFoundError('Sub-order not found');
    if (!CUSTOMER_CANCELLABLE.includes(so.status)) {
      throw new BadRequestError(`A sub-order that is ${so.status} cannot be cancelled`);
    }
    let effects: CancelEffects = {};
    await prisma.$transaction(async (tx) => {
      effects = await cancelInTx(tx, subOrderId, CUSTOMER_CANCELLABLE, userId, reason);
    }, LEDGER_TX_OPTIONS);
    const refund = await refundAfterCancel(effects, reason);
    return {
      subOrder: await prisma.subOrder.findUniqueOrThrow({ where: { id: subOrderId }, include: SUB_ORDER_INCLUDE }),
      refund,
    };
  },

  /** Customer cancels every sub-order of an order that is still cancellable; the rest keep going. */
  async cancelOrderAsCustomer(userId: string, orderId: string, reason: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { subOrders: true } });
    if (!order) throw new NotFoundError('Order not found');
    if (order.userId !== userId) throw new ForbiddenError('Access denied');
    const cancellable = order.subOrders.filter((s) => CUSTOMER_CANCELLABLE.includes(s.status));
    if (cancellable.length === 0) throw new BadRequestError(`Order cannot be cancelled in ${order.status} status`);
    const results = [];
    for (const so of cancellable.sort((a, b) => a.id.localeCompare(b.id))) {
      try {
        results.push({ subOrderId: so.id, ...(await SubOrderService.cancelAsCustomer(userId, so.id, reason)) });
      } catch (err) {
        if (!(err instanceof BadRequestError)) throw err; // lost a race with a vendor action: skip that one
      }
    }
    return {
      cancelled: results.map((r) => ({ subOrderId: r.subOrderId, refund: r.refund })),
      skipped: order.subOrders.length - results.length,
    };
  },
};
