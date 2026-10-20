import { OrderStatus, Prisma } from '@prisma/client';

/**
 * Sub-order lifecycle (owned by each vendor) and the parent Order status derived from it.
 *
 *   PENDING -> CONFIRMED -> PROCESSING -> PACKED -> SHIPPED -> DELIVERED
 *   (PENDING | CONFIRMED | PROCESSING) -> CANCELLED      vendor reject / cancel
 *   (PENDING | CONFIRMED)              -> CANCELLED      customer cancel (cancel window closes once packing starts)
 *   DELIVERED -> RETURNED -> REFUNDED                    set by the returns flow, never by a status update call
 */

export const VENDOR_TRANSITIONS: Readonly<Record<string, OrderStatus[]>> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
};

export const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = ['PENDING', 'CONFIRMED'];

export function canVendorTransition(from: OrderStatus, to: OrderStatus): boolean {
  return (VENDOR_TRANSITIONS[from] ?? []).includes(to);
}

const PROGRESS: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED'];

/**
 * Parent status from its sub-orders:
 *  - cancelled sub-orders are ignored; all cancelled => CANCELLED
 *  - all refunded => REFUNDED; all returned/refunded => RETURNED
 *  - otherwise the LEAST advanced remaining sub-order decides (an order is "delivered" only when every vendor has
 *    delivered; returned/refunded sub-orders count as delivered for progress)
 */
export function deriveOrderStatus(statuses: readonly OrderStatus[]): OrderStatus {
  const active = statuses.filter((s) => s !== 'CANCELLED');
  if (active.length === 0) return 'CANCELLED';
  if (active.every((s) => s === 'REFUNDED')) return 'REFUNDED';
  if (active.every((s) => s === 'RETURNED' || s === 'REFUNDED')) return 'RETURNED';
  const rank = (s: OrderStatus) => (s === 'RETURNED' || s === 'REFUNDED' ? PROGRESS.length - 1 : PROGRESS.indexOf(s));
  return PROGRESS[Math.min(...active.map(rank))];
}

/** Recomputes the parent order's status from its sub-orders and records the change. */
export async function syncOrderStatus(
  tx: Prisma.TransactionClient,
  orderId: string,
  changedBy: string,
  remarks?: string,
): Promise<OrderStatus> {
  const subs = await tx.subOrder.findMany({ where: { orderId }, select: { status: true } });
  const derived = deriveOrderStatus(subs.map((s) => s.status));
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } });
  if (order.status !== derived) {
    await tx.order.update({ where: { id: orderId }, data: { status: derived } });
    await tx.orderStatusHistory.create({
      data: { orderId, oldStatus: order.status, newStatus: derived, changedBy, remarks },
    });
  }
  return derived;
}
