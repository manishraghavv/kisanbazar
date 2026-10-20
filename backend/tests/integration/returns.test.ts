import crypto from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { OrderService } from '../../src/modules/orders/order.service';
import { SubOrderService } from '../../src/modules/orders/subOrder.service';
import { ReturnService } from '../../src/modules/orders/return.service';
import { reconcileKhata, postKhataEntryTx } from '../../src/modules/khata/khata.ledger';
import {
  FAKE_GATEWAY_SECRET,
  FakeGateway,
  computeCheckoutSignature,
  setGatewayForTests,
} from '../../src/modules/payments/gateway';
import {
  api,
  bearer,
  createCatalogItem,
  createFarmerDirect,
  createKhataAccount,
  fillCart,
  prisma,
  tokenFor,
} from '../helpers';

const s = (d: Prisma.Decimal) => d.toString();

let gateway: FakeGateway;
beforeEach(() => {
  gateway = new FakeGateway();
  setGatewayForTests(gateway);
});
afterAll(() => setGatewayForTests(null));

type Catalog = Awaited<ReturnType<typeof createCatalogItem>>;

/** A delivered sub-order of `qty` units of one vendor's item, paid with `paymentMethod`. */
async function deliveredOrder(
  paymentMethod: 'WALLET' | 'COD' | 'KHATA_CREDIT' | 'UPI',
  opts: { qty?: number; vendor?: Catalog; couponCode?: string } = {},
) {
  const v = opts.vendor ?? (await createCatalogItem({ stock: 50, price: 100, gstRate: 18, vendorState: '09' }));
  const f = await createFarmerDirect({ walletBalance: 5000 });
  const khata = paymentMethod === 'KHATA_CREDIT' ? await createKhataAccount(v.vendor.id, f.farmer.id, 100000) : null;
  await fillCart(f.user.id, [{ variantId: v.variant.id, quantity: opts.qty ?? 2 }]);
  const order = await OrderService.create(f.user.id, {
    addressId: f.address.id,
    paymentMethod,
    couponCode: opts.couponCode,
  });
  const so = await prisma.subOrder.findFirstOrThrow({ where: { orderId: order.id, vendorId: v.vendor.id } });
  const vendorActor = { id: v.vendorUser.id, role: 'VENDOR' };

  if (paymentMethod === 'UPI') {
    const auth = bearer(tokenFor(f.user.id));
    const init = (
      await api().post('/api/payments/initiate').set(auth).send({ orderId: order.id, paymentMethod: 'UPI' })
    ).body.data;
    const payId = `pay_ret_${crypto.randomBytes(5).toString('hex')}`;
    await api()
      .post('/api/payments/verify')
      .set(auth)
      .send({
        paymentId: init.payment.id,
        razorpay_order_id: init.gateway.gatewayOrderId,
        razorpay_payment_id: payId,
        razorpay_signature: computeCheckoutSignature(FAKE_GATEWAY_SECRET, init.gateway.gatewayOrderId, payId),
      });
  } else if (paymentMethod === 'COD') {
    await SubOrderService.updateStatus(vendorActor, so.id, { status: 'CONFIRMED' });
  } else if (paymentMethod === 'KHATA_CREDIT') {
    await SubOrderService.updateStatus(vendorActor, so.id, { status: 'CONFIRMED' });
  }
  for (const status of ['PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED']) {
    await SubOrderService.updateStatus(vendorActor, so.id, { status });
  }
  const items = await prisma.orderItem.findMany({ where: { subOrderId: so.id } });
  return { v, f, order, so, items, vendorActor, khata, customer: { id: f.user.id, role: 'FARMER' } };
}

const requestReturn = (t: Awaited<ReturnType<typeof deliveredOrder>>, quantity: number, reason = 'damaged') =>
  ReturnService.request(t.f.user.id, t.so.id, { items: [{ orderItemId: t.items[0].id, quantity }], reason });

const fullFlow = async (t: Awaited<ReturnType<typeof deliveredOrder>>, quantity: number, restock = true) => {
  const ret = await requestReturn(t, quantity);
  await ReturnService.approve(t.vendorActor, ret.id);
  await ReturnService.receive(t.vendorActor, ret.id, { restock });
  return ReturnService.resolve(t.vendorActor, ret.id);
};

const walletBalance = async (userId: string) => (await prisma.wallet.findUniqueOrThrow({ where: { userId } })).balance;

describe('return lifecycle: requested -> approved -> received -> refunded', () => {
  it('wallet order: partial return, then the rest; restock, credit notes add up to the invoice', async () => {
    const t = await deliveredOrder('WALLET', { qty: 2 }); // 200 taxable, 18% => 18 CGST + 18 SGST
    const walletAfterOrder = await walletBalance(t.f.user.id);
    const stockAfterOrder = (await prisma.productVariant.findUniqueOrThrow({ where: { id: t.v.variant.id } }))
      .stockQuantity;

    const r1 = await requestReturn(t, 1);
    expect(r1.status).toBe('REQUESTED');
    await expect(ReturnService.receive(t.vendorActor, r1.id, { restock: true })).rejects.toThrow(/approved/);
    await expect(ReturnService.resolve(t.vendorActor, r1.id)).rejects.toThrow(/received/);
    expect((await ReturnService.approve(t.vendorActor, r1.id)).status).toBe('APPROVED');
    expect((await ReturnService.receive(t.vendorActor, r1.id, { restock: true })).status).toBe('RECEIVED');
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: t.v.variant.id } })).stockQuantity).toBe(
      stockAfterOrder + 1,
    );

    const done = await ReturnService.resolve(t.vendorActor, r1.id);
    expect(done.status).toBe('REFUNDED');
    expect(done.resolution).toBe('WALLET');
    expect(s(done.refundAmount!)).toBe('118'); // 100 + 9 + 9
    expect(s((await walletBalance(t.f.user.id)).sub(walletAfterOrder))).toBe('118');
    const cn1 = await prisma.invoice.findFirstOrThrow({ where: { returnId: r1.id } });
    expect(cn1.type).toBe('CREDIT_NOTE');
    expect(cn1.invoiceNumber).toMatch(/^V[0-9A-Z]{3}C\/\d{4}\/\d{5}$/);
    expect(cn1.invoiceNumber.length).toBeLessThanOrEqual(16);
    expect([s(cn1.taxableValue), s(cn1.cgstAmount), s(cn1.sgstAmount)]).toEqual(['100', '9', '9']);
    expect(cn1.originalInvoiceId).not.toBeNull();
    expect((await prisma.subOrder.findUniqueOrThrow({ where: { id: t.so.id } })).status).toBe('DELIVERED'); // partial

    // the remaining unit: the credit note completes the invoice to the paisa
    const r2 = await fullFlow(t, 1);
    expect(r2.status).toBe('REFUNDED');
    const notes = await prisma.invoice.findMany({
      where: { subOrderId: t.so.id, type: 'CREDIT_NOTE' },
      orderBy: { seq: 'asc' },
    });
    expect(notes.map((n) => n.seq)).toEqual([1, 2]);
    const original = await prisma.invoice.findFirstOrThrow({ where: { subOrderId: t.so.id, type: 'TAX_INVOICE' } });
    const sum = (f: 'taxableValue' | 'cgstAmount' | 'sgstAmount') =>
      notes.reduce((a, n) => a.add(n[f]), new Prisma.Decimal(0));
    expect(s(sum('taxableValue'))).toBe(s(original.taxableValue));
    expect(s(sum('cgstAmount'))).toBe(s(original.cgstAmount));
    expect(s(sum('sgstAmount'))).toBe(s(original.sgstAmount));
    expect((await prisma.subOrder.findUniqueOrThrow({ where: { id: t.so.id } })).status).toBe('REFUNDED');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: t.order.id } })).status).toBe('REFUNDED');
    await expect(requestReturn(t, 1)).rejects.toThrow(/Returns are only possible after delivery/);

    // commission followed the credited value
    const commission = await prisma.vendorCommission.findFirstOrThrow({ where: { subOrderId: t.so.id } });
    expect(s(commission.grossAmount)).toBe('0');
  });

  it('khata order: credited with a reversing ledger entry; old entries are never touched', async () => {
    const t = await deliveredOrder('KHATA_CREDIT', { qty: 2 });
    const before = await prisma.khataTransaction.findMany({
      where: { khataAccountId: t.khata!.id },
      orderBy: { createdAt: 'asc' },
    });
    const outstandingBefore = (await prisma.khataAccount.findUniqueOrThrow({ where: { id: t.khata!.id } }))
      .outstandingAmount;

    const done = await fullFlow(t, 1);
    expect(done.status).toBe('CREDITED');
    expect(done.resolution).toBe('KHATA');
    const after = await prisma.khataTransaction.findMany({
      where: { khataAccountId: t.khata!.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(after).toHaveLength(before.length + 1);
    expect(after[0]).toEqual(before[0]); // original debit unchanged
    const reversal = after[after.length - 1];
    expect(reversal.type).toBe('WAIVER');
    expect(s(reversal.amount)).toBe('118');
    expect(s((await prisma.khataAccount.findUniqueOrThrow({ where: { id: t.khata!.id } })).outstandingAmount)).toBe(
      s(outstandingBefore.sub(118)),
    );
    expect(await reconcileKhata(t.khata!.id)).toEqual([]);
    // no gateway or wallet money moved
    expect(gateway.refunds).toHaveLength(0);
  });

  it('khata order where the farmer already repaid: the khata is cleared and the rest goes to the wallet', async () => {
    const t = await deliveredOrder('KHATA_CREDIT', { qty: 1 }); // total 118 + 40 delivery = 158
    await postKhataEntryTx({
      accountId: t.khata!.id,
      type: 'WAPSI_MILI',
      amount: new Prisma.Decimal(100),
      performedById: 'vendor',
    }); // outstanding 58
    const walletBefore = await walletBalance(t.f.user.id);
    const done = await fullFlow(t, 1); // credit note 118
    expect(done.status).toBe('CREDITED');
    expect(done.resolution).toBe('MIXED');
    expect(s((await prisma.khataAccount.findUniqueOrThrow({ where: { id: t.khata!.id } })).outstandingAmount)).toBe(
      '0',
    );
    expect(s((await walletBalance(t.f.user.id)).sub(walletBefore))).toBe('60'); // 118 - 58
    expect(await reconcileKhata(t.khata!.id)).toEqual([]);
  });

  it('online order: refunded through the gateway in paise', async () => {
    const t = await deliveredOrder('UPI', { qty: 2 });
    const done = await fullFlow(t, 1);
    expect(done.status).toBe('REFUNDED');
    expect(done.resolution).toBe('GATEWAY');
    expect(gateway.refunds).toHaveLength(1);
    expect(gateway.refunds[0].amountPaise).toBe(11800);
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: t.order.id } });
    expect(payment.status).toBe('PARTIALLY_REFUNDED');
  });

  it('COD order: refunded to the wallet (cash cannot be sent back)', async () => {
    const t = await deliveredOrder('COD', { qty: 1 });
    const before = await walletBalance(t.f.user.id);
    const done = await fullFlow(t, 1);
    expect(done.status).toBe('REFUNDED');
    expect(s((await walletBalance(t.f.user.id)).sub(before))).toBe('118');
  });

  it('a gateway failure keeps the return RECEIVED and a retry completes it with one credit note and one refund', async () => {
    const t = await deliveredOrder('UPI', { qty: 1 });
    const ret = await requestReturn(t, 1);
    await ReturnService.approve(t.vendorActor, ret.id);
    await ReturnService.receive(t.vendorActor, ret.id, { restock: true });

    const realRefund = gateway.refund.bind(gateway);
    gateway.refund = async () => {
      throw new Error('gateway down');
    };
    await expect(ReturnService.resolve(t.vendorActor, ret.id)).rejects.toThrow(/Refund could not be processed/);
    expect((await prisma.returns.findUniqueOrThrow({ where: { id: ret.id } })).status).toBe('RECEIVED');
    expect(await prisma.invoice.count({ where: { returnId: ret.id } })).toBe(1);

    gateway.refund = realRefund;
    // the failed attempt left a FAILED refund row; the retry must not be blocked by it
    const retry = await ReturnService.resolve(t.vendorActor, ret.id);
    expect(retry.status).toBe('REFUNDED');
    expect(await prisma.invoice.count({ where: { returnId: ret.id } })).toBe(1);
    expect(gateway.refunds).toHaveLength(1);
  });

  it('resolving twice in parallel refunds once', async () => {
    const t = await deliveredOrder('WALLET', { qty: 1 });
    const ret = await requestReturn(t, 1);
    await ReturnService.approve(t.vendorActor, ret.id);
    await ReturnService.receive(t.vendorActor, ret.id, { restock: true });
    const before = await walletBalance(t.f.user.id);
    const results = await Promise.allSettled([
      ReturnService.resolve(t.vendorActor, ret.id),
      ReturnService.resolve(t.vendorActor, ret.id),
    ]);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(s((await walletBalance(t.f.user.id)).sub(before))).toBe('118');
    expect(await prisma.invoice.count({ where: { returnId: ret.id } })).toBe(1);
  });

  it('coupon discounts shrink the credit note: tax is credited only on what was paid', async () => {
    const coupon = await prisma.coupon.create({
      data: {
        code: `RET-${crypto.randomBytes(4).toString('hex')}`,
        title: 't',
        type: 'FIXED',
        value: 20,
        startsAt: new Date(Date.now() - 1000),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const t = await deliveredOrder('WALLET', { qty: 2, couponCode: coupon.code }); // 200 - 20 = 180 taxable
    const done = await fullFlow(t, 2); // everything back
    // taxable 180 + 16.2 + 16.2 = 212.4
    expect(s(done.refundAmount!)).toBe('212.4');
    expect((await prisma.subOrder.findUniqueOrThrow({ where: { id: t.so.id } })).status).toBe('REFUNDED');
  });
});

describe('return rules', () => {
  it('only delivered sub-orders can be returned, only by their customer, only within the window, and never more than was bought', async () => {
    const v = await createCatalogItem({ stock: 20, price: 100, vendorState: '09' });
    const f = await createFarmerDirect({ walletBalance: 1000 });
    await fillCart(f.user.id, [{ variantId: v.variant.id, quantity: 2 }]);
    const order = await OrderService.create(f.user.id, { addressId: f.address.id, paymentMethod: 'WALLET' });
    const so = await prisma.subOrder.findFirstOrThrow({ where: { orderId: order.id } });
    const item = await prisma.orderItem.findFirstOrThrow({ where: { subOrderId: so.id } });
    await expect(
      ReturnService.request(f.user.id, so.id, { items: [{ orderItemId: item.id, quantity: 1 }], reason: 'too early' }),
    ).rejects.toThrow(/after delivery/);

    const actor = { id: v.vendorUser.id, role: 'VENDOR' };
    for (const status of ['PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED'])
      await SubOrderService.updateStatus(actor, so.id, { status });

    const stranger = await createFarmerDirect();
    await expect(
      ReturnService.request(stranger.user.id, so.id, {
        items: [{ orderItemId: item.id, quantity: 1 }],
        reason: 'not mine',
      }),
    ).rejects.toThrow(/not found/i);
    await expect(
      ReturnService.request(f.user.id, so.id, { items: [{ orderItemId: item.id, quantity: 3 }], reason: 'too many' }),
    ).rejects.toThrow(/Only 2 unit/);
    await expect(
      ReturnService.request(f.user.id, so.id, {
        items: [{ orderItemId: crypto.randomUUID(), quantity: 1 }],
        reason: 'foreign item',
      }),
    ).rejects.toThrow(/does not belong/);

    const first = await ReturnService.request(f.user.id, so.id, {
      items: [{ orderItemId: item.id, quantity: 1 }],
      reason: 'one back',
    });
    // units in an open return are not available for another request
    await expect(
      ReturnService.request(f.user.id, so.id, { items: [{ orderItemId: item.id, quantity: 2 }], reason: 'two more' }),
    ).rejects.toThrow(/Only 1 unit/);
    expect(first.status).toBe('REQUESTED');

    // window closed
    await prisma.subOrder.update({
      where: { id: so.id },
      data: { deliveredAt: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
    });
    await expect(
      ReturnService.request(f.user.id, so.id, { items: [{ orderItemId: item.id, quantity: 1 }], reason: 'late' }),
    ).rejects.toThrow(/return window/);
  });

  it('another seller cannot approve, receive or resolve; the request can be rejected with a note', async () => {
    const t = await deliveredOrder('WALLET', { qty: 1 });
    const other = await createCatalogItem();
    const otherActor = { id: other.vendorUser.id, role: 'VENDOR' };
    const ret = await requestReturn(t, 1);
    await expect(ReturnService.approve(otherActor, ret.id)).rejects.toThrow(/another seller/);
    expect((await api().put(`/api/returns/${ret.id}/approve`).set(bearer(other.vendorUser)).send({})).status).toBe(403);
    expect(
      (
        await api()
          .put(`/api/returns/${ret.id}/approve`)
          .set(bearer(tokenFor(t.f.user.id)))
          .send({})
      ).status,
    ).toBe(403);
    await expect(ReturnService.reject(t.vendorActor, ret.id, 'x')).resolves.toBeTruthy();
    const rejected = await prisma.returns.findUniqueOrThrow({ where: { id: ret.id } });
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.vendorNote).toBe('x');
    await expect(ReturnService.approve(t.vendorActor, ret.id)).rejects.toThrow(/requested/);
    // a rejected return frees the units for a new request
    await expect(requestReturn(t, 1)).resolves.toBeTruthy();
  });

  it('receiving without restock leaves stock alone but is logged', async () => {
    const t = await deliveredOrder('WALLET', { qty: 1 });
    const stockBefore = (await prisma.productVariant.findUniqueOrThrow({ where: { id: t.v.variant.id } }))
      .stockQuantity;
    const ret = await requestReturn(t, 1);
    await ReturnService.approve(t.vendorActor, ret.id);
    await ReturnService.receive(t.vendorActor, ret.id, { restock: false });
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: t.v.variant.id } })).stockQuantity).toBe(
      stockBefore,
    );
    const log = await prisma.inventory.findFirstOrThrow({ where: { referenceId: ret.id } });
    expect(log.reason).toBe('DAMAGED');
  });

  it('works end to end over HTTP for the customer and the seller', async () => {
    const t = await deliveredOrder('WALLET', { qty: 1 });
    const customer = bearer(tokenFor(t.f.user.id));
    const seller = bearer(t.v.vendorUser);
    const created = await api()
      .post(`/api/sub-orders/${t.so.id}/returns`)
      .set(customer)
      .send({ items: [{ orderItemId: t.items[0].id, quantity: 1 }], reason: 'wrong product' });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect((await api().get('/api/returns').set(customer)).body.data.some((r: { id: string }) => r.id === id)).toBe(
      true,
    );
    expect((await api().get('/api/returns').set(seller)).body.data.some((r: { id: string }) => r.id === id)).toBe(true);
    expect((await api().put(`/api/returns/${id}/approve`).set(seller).send({})).status).toBe(200);
    expect((await api().put(`/api/returns/${id}/receive`).set(seller).send({ restock: true })).status).toBe(200);
    const resolved = await api().post(`/api/returns/${id}/resolve`).set(seller);
    expect(resolved.status).toBe(200);
    expect(resolved.body.data.status).toBe('REFUNDED');
    const note = await api().get(`/api/invoices/${resolved.body.data.creditNote.id}/pdf`).set(customer);
    expect(note.status).toBe(200);
  });
});
