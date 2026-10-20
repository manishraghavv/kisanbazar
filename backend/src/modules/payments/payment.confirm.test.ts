import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

const prismaMock = vi.hoisted(() => ({
  payment: { findFirst: vi.fn(), updateMany: vi.fn() },
  order: { updateMany: vi.fn() },
  orderStatusHistory: { create: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock('../../common/lib/prisma', () => ({ prisma: prismaMock }));

import { PaymentService } from './payment.service';

const pending = { id: 'p-1', orderId: 'o-1', amount: new Prisma.Decimal('500.00'), currency: 'INR', status: 'PENDING', transactionId: 'rzp_x' };
const input = { paymentId: 'p-1', amountPaise: 50000, currency: 'INR', rawPayload: {} };

describe('PaymentService.confirmCapturedPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
    prismaMock.payment.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
  });

  it('ignores unknown payment IDs', async () => {
    prismaMock.payment.findFirst.mockResolvedValue(null);
    expect(await PaymentService.confirmCapturedPayment(input)).toEqual({ ignored: 'unknown_payment' });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('ignores an amount mismatch and never confirms', async () => {
    prismaMock.payment.findFirst.mockResolvedValue(pending);
    expect(await PaymentService.confirmCapturedPayment({ ...input, amountPaise: 100 })).toEqual({ ignored: 'amount_mismatch' });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('ignores a currency mismatch', async () => {
    prismaMock.payment.findFirst.mockResolvedValue(pending);
    expect(await PaymentService.confirmCapturedPayment({ ...input, currency: 'USD' })).toEqual({ ignored: 'amount_mismatch' });
  });

  it('is idempotent for already-successful payments', async () => {
    prismaMock.payment.findFirst.mockResolvedValue({ ...pending, status: 'SUCCESS' });
    expect(await PaymentService.confirmCapturedPayment(input)).toEqual({ ignored: 'already_processed' });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('marks the payment SUCCESS and confirms the PENDING order on a matching amount', async () => {
    prismaMock.payment.findFirst.mockResolvedValue(pending);
    expect(await PaymentService.confirmCapturedPayment({ ...input, gatewayPaymentId: 'pay_1' })).toEqual({});
    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCESS', transactionId: 'pay_1' }) }));
    expect(prismaMock.order.updateMany).toHaveBeenCalledWith({ where: { id: 'o-1', status: 'PENDING' }, data: { status: 'CONFIRMED' } });
    expect(prismaMock.orderStatusHistory.create).toHaveBeenCalled();
  });
});
