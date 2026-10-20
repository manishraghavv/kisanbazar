import { Prisma } from '@prisma/client';
import { prisma } from '../../common/lib/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/errors';
import { LEDGER_TX_OPTIONS, postKhataEntry } from '../khata/khata.ledger';
import { creditWallet } from '../payments/wallet.ledger';
import { RefundService } from '../payments/payment.service';
import { roundMoney } from '../gst/gst';
import { issueCreditNote } from './invoice.service';
import { syncOrderStatus } from './orderStatus';
import { Actor } from './subOrder.service';

/**
 * Returns lifecycle (per sub-order, so one vendor's return never touches another's):
 *
 *   REQUESTED --approve--> APPROVED --receive--> RECEIVED --resolve--> REFUNDED | CREDITED
 *        \--reject--> REJECTED
 *
 *  - request  (customer): only DELIVERED sub-orders, inside RETURN_WINDOW_DAYS (default 7) of delivery, for at most
 *             the units not already returned or in another open return.
 *  - receive  (vendor): goods are back; optionally restocked (Inventory log either way). Units are counted as
 *             returned here, and a sub-order whose units are all back becomes RETURNED.
 *  - resolve  (vendor/admin): issues the CREDIT NOTE (gapless numbering) and moves the money:
 *             khata orders -> a reversing WAIVER entry on that vendor's khata (old entries are never edited; anything the
 *                             farmer had already repaid goes to their wallet);
 *             online / wallet / COD -> a refund of the credit-note total through RefundService (gateway for online
 *                             payments, wallet for wallet and COD). Safe to retry: every step is idempotent.
 *  The delivery charge is not refunded on returns (assumption: only goods are credited).
 */

const OPEN_STATUSES = ['REQUESTED', 'APPROVED', 'RECEIVED'];

export function returnWindowDays(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.RETURN_WINDOW_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 7;
}

const RETURN_INCLUDE = {
  items: {
    include: {
      orderItem: {
        include: { variant: { select: { sku: true, variantName: true, product: { select: { name: true } } } } },
      },
    },
  },
  creditNote: { select: { id: true, invoiceNumber: true, totalAmount: true } },
  subOrder: {
    select: {
      id: true,
      subOrderNumber: true,
      vendorId: true,
      status: true,
      vendor: { select: { userId: true, businessName: true } },
    },
  },
} satisfies Prisma.ReturnsInclude;

async function loadForSeller(returnId: string, actor: Actor) {
  const ret = await prisma.returns.findUnique({ where: { id: returnId }, include: RETURN_INCLUDE });
  if (!ret || !ret.subOrder) throw new NotFoundError('Return not found');
  if (actor.role === 'ADMIN') return ret;
  if (actor.role === 'VENDOR' && ret.subOrder.vendor.userId === actor.id) return ret;
  throw new ForbiddenError('This return belongs to another seller');
}

async function lockReturn(tx: Prisma.TransactionClient, returnId: string) {
  await tx.$queryRaw`SELECT "id" FROM "returns" WHERE "id" = ${returnId} FOR UPDATE`;
  return tx.returns.findUniqueOrThrow({
    where: { id: returnId },
    include: { items: true, subOrder: { include: { order: true } } },
  });
}

export const ReturnService = {
  async request(
    userId: string,
    subOrderId: string,
    data: { items: Array<{ orderItemId: string; quantity: number }>; reason: string; photoUrls?: string[] },
  ) {
    const so = await prisma.subOrder.findUnique({
      where: { id: subOrderId },
      include: { order: true, items: true, vendor: { select: { userId: true } } },
    });
    if (!so || so.order.userId !== userId) throw new NotFoundError('Sub-order not found');
    if (so.status !== 'DELIVERED')
      throw new BadRequestError(`Returns are only possible after delivery (this is ${so.status})`);
    const deliveredAt = so.deliveredAt ?? so.createdAt;
    const deadline = new Date(deliveredAt.getTime() + returnWindowDays() * 24 * 60 * 60 * 1000);
    if (new Date() > deadline) throw new BadRequestError(`The ${returnWindowDays()}-day return window has closed`);
    if (data.items.length === 0) throw new BadRequestError('Choose at least one item to return');

    return prisma.$transaction(async (tx) => {
      // Serialise concurrent requests on the same sub-order so the "units still returnable" check cannot race.
      await tx.$queryRaw`SELECT "id" FROM "sub_orders" WHERE "id" = ${subOrderId} FOR UPDATE`;
      const open = await tx.returnItem.findMany({
        where: { return: { subOrderId, status: { in: OPEN_STATUSES } } },
        select: { orderItemId: true, quantity: true },
      });
      const seen = new Set<string>();
      for (const line of data.items) {
        if (seen.has(line.orderItemId)) throw new BadRequestError('List each item once');
        seen.add(line.orderItemId);
        const item = so.items.find((i) => i.id === line.orderItemId);
        if (!item) throw new BadRequestError('An item does not belong to this sub-order');
        const inOpenReturns = open.filter((o) => o.orderItemId === item.id).reduce((a, o) => a + o.quantity, 0);
        const returnable = item.quantity - item.returnedQuantity - inOpenReturns;
        if (line.quantity > returnable) {
          throw new BadRequestError(`Only ${Math.max(returnable, 0)} unit(s) of an item can still be returned`);
        }
      }
      const ret = await tx.returns.create({
        data: {
          orderId: so.orderId,
          subOrderId,
          requestedById: userId,
          reason: data.reason,
          photoUrls: data.photoUrls ?? [],
          status: 'REQUESTED',
          items: { create: data.items.map((l) => ({ orderItemId: l.orderItemId, quantity: l.quantity })) },
        },
        include: RETURN_INCLUDE,
      });
      await tx.orderItem.updateMany({
        where: { id: { in: data.items.map((l) => l.orderItemId) } },
        data: { returnRequested: true },
      });
      await tx.notification.create({
        data: {
          userId: so.vendor.userId,
          title: 'Return requested',
          message: `A customer requested a return on ${so.subOrderNumber}.`,
          type: 'ORDER_UPDATE',
        },
      });
      return ret;
    }, LEDGER_TX_OPTIONS);
  },

  async list(actor: Actor, filters: { page: number; limit: number; status?: string; subOrderId?: string }) {
    const where: Prisma.ReturnsWhereInput = {};
    if (actor.role === 'VENDOR') where.subOrder = { vendor: { userId: actor.id } };
    else if (actor.role !== 'ADMIN') where.requestedById = actor.id;
    if (filters.status) where.status = filters.status;
    if (filters.subOrderId) where.subOrderId = filters.subOrderId;
    const skip = (filters.page - 1) * filters.limit;
    const [returns, total] = await Promise.all([
      prisma.returns.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
        include: RETURN_INCLUDE,
      }),
      prisma.returns.count({ where }),
    ]);
    return { returns, total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) };
  },

  async getById(returnId: string, actor: Actor) {
    const ret = await prisma.returns.findUnique({ where: { id: returnId }, include: RETURN_INCLUDE });
    if (!ret) throw new NotFoundError('Return not found');
    if (actor.role === 'ADMIN' || ret.requestedById === actor.id) return ret;
    if (actor.role === 'VENDOR' && ret.subOrder?.vendor.userId === actor.id) return ret;
    throw new ForbiddenError('Access denied');
  },

  async approve(actor: Actor, returnId: string, note?: string) {
    await loadForSeller(returnId, actor);
    const moved = await prisma.returns.updateMany({
      where: { id: returnId, status: 'REQUESTED' },
      data: { status: 'APPROVED', approvedAt: new Date(), vendorNote: note },
    });
    if (moved.count === 0) throw new BadRequestError('Only a requested return can be approved');
    return prisma.returns.findUniqueOrThrow({ where: { id: returnId }, include: RETURN_INCLUDE });
  },

  async reject(actor: Actor, returnId: string, note: string) {
    await loadForSeller(returnId, actor);
    const moved = await prisma.returns.updateMany({
      where: { id: returnId, status: 'REQUESTED' },
      data: { status: 'REJECTED', vendorNote: note, resolvedAt: new Date() },
    });
    if (moved.count === 0) throw new BadRequestError('Only a requested return can be rejected');
    const ret = await prisma.returns.findUniqueOrThrow({ where: { id: returnId }, include: RETURN_INCLUDE });
    await prisma.orderItem.updateMany({
      where: { id: { in: ret.items.map((i) => i.orderItemId) }, returnedQuantity: 0 },
      data: { returnRequested: false },
    });
    return ret;
  },

  /** Goods are back with the seller. `restock` puts the units back on sale. */
  async receive(actor: Actor, returnId: string, data: { restock: boolean }) {
    await loadForSeller(returnId, actor);
    await prisma.$transaction(async (tx) => {
      const ret = await lockReturn(tx, returnId);
      if (ret.status !== 'APPROVED') throw new BadRequestError('Only an approved return can be marked as received');

      for (const line of [...ret.items].sort((a, b) => a.orderItemId.localeCompare(b.orderItemId))) {
        const item = await tx.orderItem.update({
          where: { id: line.orderItemId },
          data: { returnedQuantity: { increment: line.quantity } },
        });
        if (data.restock) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockQuantity: { increment: line.quantity } },
          });
        }
        await tx.inventory.create({
          data: {
            variantId: item.variantId,
            quantityChange: data.restock ? line.quantity : 0,
            reason: data.restock ? 'RETURN' : 'DAMAGED',
            referenceId: ret.id,
            performedById: actor.id,
          },
        });
      }
      await tx.returns.update({
        where: { id: returnId },
        data: { status: 'RECEIVED', receivedAt: new Date(), restock: data.restock },
      });

      // Every unit of the sub-order is back => the sub-order itself is RETURNED.
      const items = await tx.orderItem.findMany({ where: { subOrderId: ret.subOrderId! } });
      if (items.every((i) => i.returnedQuantity >= i.quantity)) {
        await tx.subOrder.update({ where: { id: ret.subOrderId! }, data: { status: 'RETURNED' } });
        await tx.orderStatusHistory.create({
          data: {
            orderId: ret.orderId,
            subOrderId: ret.subOrderId,
            oldStatus: 'DELIVERED',
            newStatus: 'RETURNED',
            changedBy: actor.id,
            remarks: 'All items returned',
          },
        });
        await syncOrderStatus(tx, ret.orderId, actor.id, 'All items of a sub-order returned');
      }
    }, LEDGER_TX_OPTIONS);
    return prisma.returns.findUniqueOrThrow({ where: { id: returnId }, include: RETURN_INCLUDE });
  },

  /** Issues the credit note and returns the money. Idempotent: safe to call again after a gateway failure. */
  async resolve(actor: Actor, returnId: string) {
    await loadForSeller(returnId, actor);

    // Step 1 (one transaction): credit note + (for khata) the reversing ledger entry.
    const step = await prisma.$transaction(async (tx) => {
      const ret = await lockReturn(tx, returnId);
      if (ret.status === 'REFUNDED' || ret.status === 'CREDITED') return { done: true as const };
      if (ret.status !== 'RECEIVED') throw new BadRequestError('The goods must be received before the refund');

      const note = await issueCreditNote(tx, returnId);
      const amount = note.totalAmount;
      const order = ret.subOrder!.order;

      // The seller's commission shrinks with the credited value.
      const commission = await tx.vendorCommission.findFirst({ where: { subOrderId: ret.subOrderId! } });
      if (commission) {
        const commissionCut = roundMoney(note.taxableValue.mul(commission.commissionRate).div(100));
        await tx.vendorCommission.update({
          where: { id: commission.id },
          data: {
            grossAmount: commission.grossAmount.sub(note.taxableValue),
            commissionAmount: commission.commissionAmount.sub(commissionCut),
            netAmount: commission.netAmount.sub(note.taxableValue.sub(commissionCut)),
          },
        });
      }

      if (order.paymentMethod === 'KHATA_CREDIT' && ret.subOrder!.khataAccountId && amount.gt(0)) {
        const result = await postKhataEntry(tx, {
          accountId: ret.subOrder!.khataAccountId,
          type: 'WAIVER',
          amount,
          performedById: actor.id,
          linkedOrderId: ret.orderId,
          remarks: `Return ${ret.id} credited (${note.invoiceNumber})`,
          idempotencyKey: `return-khata:${returnId}`,
          allowedStatuses: ['ACTIVE', 'OVERDUE', 'SETTLED', 'SUSPENDED', 'WRITTEN_OFF'],
          clampCredit: true,
        });
        const applied = result.transaction ? result.transaction.amount : new Prisma.Decimal(0);
        const excess = amount.sub(applied);
        if (excess.gt(0)) {
          await creditWallet(tx, order.userId, excess, {
            remarks: `Return ${ret.id}: credit already repaid, refunded to wallet`,
            referenceId: ret.orderId,
            idempotencyKey: `return-khata-excess:${returnId}`,
          });
        }
        await tx.returns.update({
          where: { id: returnId },
          data: {
            status: 'CREDITED',
            refundAmount: amount,
            resolution: excess.gt(0) ? 'MIXED' : 'KHATA',
            resolvedAt: new Date(),
          },
        });
        await finishSubOrderIfFullyReturned(tx, ret.subOrderId!, ret.orderId, actor.id);
        return { done: true as const };
      }

      await tx.returns.update({ where: { id: returnId }, data: { refundAmount: amount } });
      return { done: false as const, amount, orderId: ret.orderId, paymentMethod: order.paymentMethod };
    }, LEDGER_TX_OPTIONS);

    if (!step.done) {
      // Step 2: refund the payment (gateway / wallet). Outside any DB transaction; retries reuse the same key.
      const payment = await prisma.payment.findFirst({
        where: {
          orderId: step.orderId,
          status: { in: ['SUCCESS', 'PARTIALLY_REFUNDED', 'PENDING'] },
          paymentMethod: { not: 'KHATA_CREDIT' },
        },
        orderBy: { createdAt: 'asc' },
      });
      if (!payment) {
        // Orders placed before COD payments were recorded at checkout: credit the wallet directly.
        if (step.paymentMethod !== 'COD') throw new BadRequestError('There is no payment to refund for this order');
        const order = await prisma.order.findUniqueOrThrow({ where: { id: step.orderId } });
        await prisma.$transaction(async (tx) => {
          await creditWallet(tx, order.userId, step.amount, {
            remarks: `Return ${returnId}: COD refund to wallet`,
            referenceId: order.id,
            idempotencyKey: `return-cod:${returnId}`,
          });
          const ret = await tx.returns.findUniqueOrThrow({ where: { id: returnId } });
          await tx.returns.update({
            where: { id: returnId },
            data: { status: 'REFUNDED', resolution: 'WALLET', resolvedAt: new Date() },
          });
          await finishSubOrderIfFullyReturned(tx, ret.subOrderId!, ret.orderId, actor.id);
        }, LEDGER_TX_OPTIONS);
        return prisma.returns.findUniqueOrThrow({ where: { id: returnId }, include: RETURN_INCLUDE });
      }
      if (step.amount.gt(0)) {
        // A gateway failure surfaces as 502 and leaves the return RECEIVED; calling resolve again retries safely.
        await RefundService.refundPayment({
          paymentId: payment.id,
          amount: step.amount,
          reason: `Return ${returnId}`,
          idempotencyKey: `return:${returnId}`,
        });
      }
      await prisma.$transaction(async (tx) => {
        const ret = await tx.returns.findUniqueOrThrow({ where: { id: returnId } });
        await tx.returns.update({
          where: { id: returnId },
          data: {
            status: 'REFUNDED',
            resolution: payment.paymentMethod === 'WALLET' || payment.paymentMethod === 'COD' ? 'WALLET' : 'GATEWAY',
            resolvedAt: new Date(),
          },
        });
        await finishSubOrderIfFullyReturned(tx, ret.subOrderId!, ret.orderId, actor.id);
      }, LEDGER_TX_OPTIONS);
    }
    return prisma.returns.findUniqueOrThrow({ where: { id: returnId }, include: RETURN_INCLUDE });
  },
};

/** RETURNED sub-orders with no open returns left become REFUNDED (the parent status follows). */
async function finishSubOrderIfFullyReturned(
  tx: Prisma.TransactionClient,
  subOrderId: string,
  orderId: string,
  actorId: string,
) {
  const so = await tx.subOrder.findUniqueOrThrow({ where: { id: subOrderId } });
  if (so.status !== 'RETURNED') return;
  const open = await tx.returns.count({ where: { subOrderId, status: { in: OPEN_STATUSES } } });
  if (open > 0) return;
  await tx.subOrder.update({ where: { id: subOrderId }, data: { status: 'REFUNDED' } });
  await tx.orderStatusHistory.create({
    data: {
      orderId,
      subOrderId,
      oldStatus: 'RETURNED',
      newStatus: 'REFUNDED',
      changedBy: actorId,
      remarks: 'Return resolved',
    },
  });
  await syncOrderStatus(tx, orderId, actorId, 'Return resolved');
}
