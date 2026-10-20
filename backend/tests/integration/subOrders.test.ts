import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { OrderService } from '../../src/modules/orders/order.service';
import { SubOrderService } from '../../src/modules/orders/subOrder.service';
import { reconcileKhata } from '../../src/modules/khata/khata.ledger';
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

const D = (v: number | string) => new Prisma.Decimal(v);
const s = (d: Prisma.Decimal) => d.toString();

type Catalog = Awaited<ReturnType<typeof createCatalogItem>>;

/** Three vendors in three states: Uttar Pradesh (09), Maharashtra (27), Karnataka (29). */
async function threeVendors() {
  const a = await createCatalogItem({ stock: 100, price: 100, gstRate: 5, vendorState: '09' });
  const b = await createCatalogItem({ stock: 100, price: 400, gstRate: 12, vendorState: '27' });
  const c = await createCatalogItem({ stock: 100, price: 50, gstRate: 18, vendorState: '29' });
  return { a, b, c };
}

async function cartOf(userId: string, lines: Array<[Catalog, number]>) {
  await fillCart(
    userId,
    lines.map(([c, quantity]) => ({ variantId: c.variant.id, quantity })),
  );
}

const place = (userId: string, addressId: string, extra: Record<string, unknown> = {}) =>
  OrderService.create(userId, { addressId, paymentMethod: 'COD', ...extra });

const subOrderOf = (orderId: string, vendorId: string) =>
  prisma.subOrder.findUniqueOrThrow({ where: { orderId_vendorId: { orderId, vendorId } } });

describe('checkout splits the cart into one sub-order per vendor', () => {
  it('3-vendor cart: 3 sub-orders with the right GST regime, delivery and totals', async () => {
    const { a, b, c } = await threeVendors();
    const f = await createFarmerDirect(); // buyer in Uttar Pradesh (09)
    await cartOf(f.user.id, [
      [a, 2], // 200 @5%  intra-state  -> CGST 5 + SGST 5
      [b, 1], // 400 @12% inter-state  -> IGST 48
      [c, 3], // 150 @18% inter-state  -> IGST 27
    ]);
    const order = await place(f.user.id, f.address.id);

    expect(order.subOrders).toHaveLength(3);
    const sa = await subOrderOf(order.id, a.vendor.id);
    const sb = await subOrderOf(order.id, b.vendor.id);
    const sc = await subOrderOf(order.id, c.vendor.id);

    expect([sa.isInterState, sb.isInterState, sc.isInterState]).toEqual([false, true, true]);
    expect([s(sa.cgstAmount), s(sa.sgstAmount), s(sa.igstAmount)]).toEqual(['5', '5', '0']);
    expect([s(sb.cgstAmount), s(sb.sgstAmount), s(sb.igstAmount)]).toEqual(['0', '0', '48']);
    expect([s(sc.cgstAmount), s(sc.sgstAmount), s(sc.igstAmount)]).toEqual(['0', '0', '27']);
    // delivery is charged per sub-order below the free threshold: A 200 -> 40, B 400 -> 40, C 150 -> 40
    expect([s(sa.deliveryCharge), s(sb.deliveryCharge), s(sc.deliveryCharge)]).toEqual(['40', '40', '40']);
    expect([s(sa.totalAmount), s(sb.totalAmount), s(sc.totalAmount)]).toEqual(['250', '488', '217']);
    expect([sa.placeOfSupply, sa.sellerStateCode]).toEqual(['09', '09']);
    expect(sb.sellerStateCode).toBe('27');

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(s(fresh.totalAmount)).toBe('955'); // 250 + 488 + 217
    expect(s(fresh.gstAmount)).toBe('85');
    expect([s(fresh.cgstAmount), s(fresh.sgstAmount), s(fresh.igstAmount)]).toEqual(['5', '5', '75']);
    expect(fresh.placeOfSupply).toBe('09');
    expect(fresh.status).toBe('PENDING');

    // every line belongs to its vendor's sub-order and carries a GST snapshot; commissions are per sub-order
    const items = await prisma.orderItem.findMany({ where: { orderId: order.id }, include: { subOrder: true } });
    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item.hsnCode).toBe('3102');
      expect(s(item.taxableValue.add(item.cgstAmount).add(item.sgstAmount).add(item.igstAmount))).not.toBe('0');
    }
    expect(await prisma.vendorCommission.count({ where: { orderId: order.id } })).toBe(3);
    const commissionA = await prisma.vendorCommission.findFirstOrThrow({ where: { subOrderId: sa.id } });
    expect(commissionA.vendorId).toBe(a.vendor.id);
    expect(s(commissionA.grossAmount)).toBe('200');

    // stock of all three variants was taken
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: c.variant.id } })).stockQuantity).toBe(97);
  });

  it('a seller without a GST state blocks checkout with a clear message and nothing is taken', async () => {
    const a = await createCatalogItem({ stock: 5, price: 100, vendorState: null });
    const f = await createFarmerDirect();
    await cartOf(f.user.id, [[a, 1]]);
    await expect(place(f.user.id, f.address.id)).rejects.toThrow(/GST state/);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: a.variant.id } })).stockQuantity).toBe(5);
    expect(await prisma.cartItem.count({ where: { cart: { userId: f.user.id } } })).toBe(1);
  });

  it('an address without a state is rejected', async () => {
    const a = await createCatalogItem({ stock: 5, price: 100 });
    const f = await createFarmerDirect();
    await prisma.address.update({ where: { id: f.address.id }, data: { stateCode: null } });
    await cartOf(f.user.id, [[a, 1]]);
    await expect(place(f.user.id, f.address.id)).rejects.toThrow(/choose its state/);
  });

  it('POST /orders/quote returns the same breakdown without touching stock or the cart', async () => {
    const { a, b } = await threeVendors();
    const f = await createFarmerDirect();
    await cartOf(f.user.id, [
      [a, 1],
      [b, 1],
    ]);
    const res = await api()
      .post('/api/orders/quote')
      .set(bearer(tokenFor(f.user.id)))
      .send({ addressId: f.address.id });
    expect(res.status).toBe(200);
    expect(res.body.data.subOrders).toHaveLength(2);
    expect(res.body.data.placeOfSupply).toBe('09');
    const totals = res.body.data.totals;
    expect(totals.totalAmount).toBe('633'); // A: 100 + 5 GST + 40 delivery, B: 400 + 48 IGST + 40 delivery
  });

  it('(quote total equals what checkout then charges)', async () => {
    const { a, b } = await threeVendors();
    const f = await createFarmerDirect();
    await cartOf(f.user.id, [
      [a, 1],
      [b, 1],
    ]);
    const quote = await api()
      .post('/api/orders/quote')
      .set(bearer(tokenFor(f.user.id)))
      .send({ addressId: f.address.id });
    const order = await place(f.user.id, f.address.id);
    expect(quote.body.data.totals.totalAmount).toBe(s(order.totalAmount));
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: a.variant.id } })).stockQuantity).toBe(99);
  });
});

describe('coupons across sub-orders', () => {
  const coupon = (data: Partial<Prisma.CouponUncheckedCreateInput>) =>
    prisma.coupon.create({
      data: {
        code: `C3-${randomUUID().slice(0, 8)}`,
        title: 't',
        type: 'PERCENTAGE',
        value: 10,
        startsAt: new Date(Date.now() - 1000),
        expiresAt: new Date(Date.now() + 86_400_000),
        ...data,
      },
    });

  it('a percentage coupon is spread proportionally and GST is charged on the discounted value', async () => {
    const a = await createCatalogItem({ stock: 10, price: 600, gstRate: 18, vendorState: '09' });
    const b = await createCatalogItem({ stock: 10, price: 400, gstRate: 5, vendorState: '27' });
    const c = await coupon({ value: 10 });
    const f = await createFarmerDirect();
    await cartOf(f.user.id, [
      [a, 1],
      [b, 1],
    ]);
    const order = await place(f.user.id, f.address.id, { couponCode: c.code });
    const sa = await subOrderOf(order.id, a.vendor.id);
    const sb = await subOrderOf(order.id, b.vendor.id);
    expect([s(sa.discountAmount), s(sb.discountAmount)]).toEqual(['60', '40']);
    expect(s(sa.taxableValue)).toBe('540');
    expect([s(sa.cgstAmount), s(sa.sgstAmount)]).toEqual(['48.6', '48.6']);
    expect(s(sb.igstAmount)).toBe('18');
    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(s(fresh.discountAmount)).toBe('100');
    expect(s(fresh.totalAmount)).toBe(s(sa.totalAmount.add(sb.totalAmount)));
    expect(await prisma.couponUsage.count({ where: { couponId: c.id } })).toBe(1);
  });

  it('a vendor-scoped coupon discounts only that vendor and is refused when that vendor is not in the cart', async () => {
    const a = await createCatalogItem({ stock: 10, price: 300, vendorState: '09' });
    const b = await createCatalogItem({ stock: 10, price: 300, vendorState: '09' });
    const c = await coupon({ type: 'FIXED', value: 50, applicableTo: 'VENDOR', vendorId: b.vendor.id });
    const f = await createFarmerDirect();
    await cartOf(f.user.id, [
      [a, 1],
      [b, 1],
    ]);
    const order = await place(f.user.id, f.address.id, { couponCode: c.code });
    expect(s((await subOrderOf(order.id, a.vendor.id)).discountAmount)).toBe('0');
    expect(s((await subOrderOf(order.id, b.vendor.id)).discountAmount)).toBe('50');

    const g = await createFarmerDirect();
    await cartOf(g.user.id, [[a, 1]]);
    await expect(place(g.user.id, g.address.id, { couponCode: c.code })).rejects.toThrow(/different seller/);
    // the failed attempt did not consume a redemption
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: c.id } })).usedCount).toBe(1);
  });

  it('enforces the per-user limit (and the unique constraint behind it)', async () => {
    const a = await createCatalogItem({ stock: 10, price: 100, vendorState: '09' });
    const c = await coupon({ type: 'FIXED', value: 10, perUserLimit: 1 });
    const f = await createFarmerDirect();
    await cartOf(f.user.id, [[a, 1]]);
    await place(f.user.id, f.address.id, { couponCode: c.code });

    await cartOf(f.user.id, [[a, 1]]);
    await expect(place(f.user.id, f.address.id, { couponCode: c.code })).rejects.toThrow(/already used this coupon/);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: c.id } })).usedCount).toBe(1);

    // belt and braces: the database itself refuses a second redemption number for the same user
    await expect(
      prisma.couponUsage.create({ data: { couponId: c.id, userId: f.user.id, seq: 1, orderId: randomUUID() } }),
    ).rejects.toThrow();

    // another user can still use it
    const g = await createFarmerDirect();
    await cartOf(g.user.id, [[a, 1]]);
    await expect(place(g.user.id, g.address.id, { couponCode: c.code })).resolves.toBeTruthy();
  });

  it('a perUserLimit of 2 allows exactly two redemptions', async () => {
    const a = await createCatalogItem({ stock: 10, price: 100, vendorState: '09' });
    const c = await coupon({ type: 'FIXED', value: 10, perUserLimit: 2 });
    const f = await createFarmerDirect();
    for (let i = 0; i < 2; i++) {
      await cartOf(f.user.id, [[a, 1]]);
      await place(f.user.id, f.address.id, { couponCode: c.code });
    }
    await cartOf(f.user.id, [[a, 1]]);
    await expect(place(f.user.id, f.address.id, { couponCode: c.code })).rejects.toThrow(/already used/);
    expect(await prisma.couponUsage.count({ where: { couponId: c.id, userId: f.user.id } })).toBe(2);
  });
});

describe('khata credit is applied per vendor', () => {
  it('posts one ledger entry per vendor sub-order against that vendor’s own khata account', async () => {
    const a = await createCatalogItem({ stock: 10, price: 100, vendorState: '09' });
    const b = await createCatalogItem({ stock: 10, price: 200, vendorState: '27' });
    const f = await createFarmerDirect();
    const ka = await createKhataAccount(a.vendor.id, f.farmer.id, 1000);
    const kb = await createKhataAccount(b.vendor.id, f.farmer.id, 1000);
    await cartOf(f.user.id, [
      [a, 1],
      [b, 1],
    ]);
    const order = await place(f.user.id, f.address.id, { paymentMethod: 'KHATA_CREDIT' });

    const sa = await subOrderOf(order.id, a.vendor.id);
    const sb = await subOrderOf(order.id, b.vendor.id);
    expect(sa.khataAccountId).toBe(ka.id);
    expect(sb.khataAccountId).toBe(kb.id);
    const accA = await prisma.khataAccount.findUniqueOrThrow({ where: { id: ka.id } });
    const accB = await prisma.khataAccount.findUniqueOrThrow({ where: { id: kb.id } });
    expect(s(accA.outstandingAmount)).toBe(s(sa.totalAmount)); // 100 + 5 + 40
    expect(s(accB.outstandingAmount)).toBe(s(sb.totalAmount)); // 200 + 24 IGST + 40
    expect(await reconcileKhata(ka.id)).toEqual([]);
    expect(await reconcileKhata(kb.id)).toEqual([]);
  });

  it('one vendor’s limit being exceeded rolls back the whole order, including the other vendor’s entry', async () => {
    const a = await createCatalogItem({ stock: 10, price: 100, vendorState: '09' });
    const b = await createCatalogItem({ stock: 10, price: 200, vendorState: '09' });
    const f = await createFarmerDirect();
    const ka = await createKhataAccount(a.vendor.id, f.farmer.id, 1000);
    await createKhataAccount(b.vendor.id, f.farmer.id, 50); // too small for B's ~250
    await cartOf(f.user.id, [
      [a, 1],
      [b, 1],
    ]);
    await expect(place(f.user.id, f.address.id, { paymentMethod: 'KHATA_CREDIT' })).rejects.toThrow(/credit limit/);
    expect(s((await prisma.khataAccount.findUniqueOrThrow({ where: { id: ka.id } })).outstandingAmount)).toBe('0');
    expect(await prisma.khataTransaction.count({ where: { khataAccountId: ka.id } })).toBe(0);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: a.variant.id } })).stockQuantity).toBe(10);
    expect(await prisma.order.count({ where: { userId: f.user.id } })).toBe(0);
  });

  it('names the vendor you have no khata with', async () => {
    const a = await createCatalogItem({ stock: 10, price: 100, vendorState: '09' });
    const b = await createCatalogItem({ stock: 10, price: 100, vendorState: '09' });
    const f = await createFarmerDirect();
    await createKhataAccount(a.vendor.id, f.farmer.id, 1000);
    await cartOf(f.user.id, [
      [a, 1],
      [b, 1],
    ]);
    await expect(place(f.user.id, f.address.id, { paymentMethod: 'KHATA_CREDIT' })).rejects.toThrow(
      /no khata account with/i,
    );
  });
});

describe('a vendor can act only on their own sub-order', () => {
  async function twoVendorOrder(paymentMethod: 'COD' | 'WALLET' = 'COD') {
    const a = await createCatalogItem({ stock: 20, price: 100, vendorState: '09' });
    const b = await createCatalogItem({ stock: 20, price: 100, vendorState: '27' });
    const f = await createFarmerDirect({ walletBalance: 5000 });
    await cartOf(f.user.id, [
      [a, 1],
      [b, 1],
    ]);
    const order = await place(f.user.id, f.address.id, { paymentMethod });
    const sa = await subOrderOf(order.id, a.vendor.id);
    const sb = await subOrderOf(order.id, b.vendor.id);
    return { a, b, f, order, sa, sb, customer: bearer(tokenFor(f.user.id)) };
  }

  it('vendor A cannot read, update, ship or cancel vendor B’s sub-order', async () => {
    const t = await twoVendorOrder();
    const asA = bearer(t.a.vendorUser);

    expect((await api().get(`/api/sub-orders/${t.sb.id}`).set(asA)).status).toBe(403);
    expect((await api().get(`/api/sub-orders/${t.sa.id}`).set(asA)).status).toBe(200);
    expect((await api().put(`/api/sub-orders/${t.sb.id}/status`).set(asA).send({ status: 'CONFIRMED' })).status).toBe(
      403,
    );
    expect((await api().post(`/api/sub-orders/${t.sb.id}/shipments`).set(asA).send({ awbNumber: 'X1' })).status).toBe(
      403,
    );
    expect((await prisma.subOrder.findUniqueOrThrow({ where: { id: t.sb.id } })).status).toBe('PENDING');

    // the legacy order-level status route acts on the caller's OWN sub-order only
    const legacy = await api().put(`/api/orders/${t.order.id}/status`).set(asA).send({ status: 'CONFIRMED' });
    expect(legacy.status).toBe(200);
    expect((await prisma.subOrder.findUniqueOrThrow({ where: { id: t.sa.id } })).status).toBe('CONFIRMED');
    expect((await prisma.subOrder.findUniqueOrThrow({ where: { id: t.sb.id } })).status).toBe('PENDING');

    // and a vendor with no part in the order gets 403
    const outsider = await createCatalogItem();
    expect(
      (
        await api()
          .put(`/api/orders/${t.order.id}/status`)
          .set(bearer(outsider.vendorUser))
          .send({ status: 'CONFIRMED' })
      ).status,
    ).toBe(403);
  });

  it('a seller sees only their own part of the order; the customer sees everything', async () => {
    const t = await twoVendorOrder();
    const asA = await api().get(`/api/orders/${t.order.id}`).set(bearer(t.a.vendorUser));
    expect(asA.status).toBe(200);
    expect(asA.body.data.subOrders.map((x: { id: string }) => x.id)).toEqual([t.sa.id]);
    expect(asA.body.data.payments).toEqual([]);

    const asCustomer = await api().get(`/api/orders/${t.order.id}`).set(t.customer);
    expect(asCustomer.body.data.subOrders).toHaveLength(2);

    const list = await api().get('/api/sub-orders').set(bearer(t.a.vendorUser));
    expect(list.body.data.every((x: { vendorId: string }) => x.vendorId === t.a.vendor.id)).toBe(true);
    expect(list.body.data.some((x: { id: string }) => x.id === t.sb.id)).toBe(false);
  });

  it('another vendor cannot touch a shipment or its events', async () => {
    const t = await twoVendorOrder();
    await SubOrderService.updateStatus({ id: t.b.vendorUser.id, role: 'VENDOR' }, t.sb.id, { status: 'CONFIRMED' });
    const created = await api()
      .post(`/api/sub-orders/${t.sb.id}/shipments`)
      .set(bearer(t.b.vendorUser))
      .send({ awbNumber: 'B-1' });
    expect(created.status).toBe(201);
    const shipmentId = created.body.data.id;
    const asA = bearer(t.a.vendorUser);
    expect((await api().put(`/api/shipments/${shipmentId}`).set(asA).send({ currentStatus: 'HACKED' })).status).toBe(
      403,
    );
    expect((await api().post(`/api/shipments/${shipmentId}/events`).set(asA).send({ eventStatus: 'X' })).status).toBe(
      403,
    );
    expect((await api().get(`/api/shipments/${shipmentId}/events`).set(asA)).status).toBe(403);
    // owner, customer and legacy order route are fine
    expect(
      (await api().put(`/api/shipments/${shipmentId}`).set(bearer(t.b.vendorUser)).send({ currentStatus: 'PICKED' }))
        .status,
    ).toBe(200);
    expect((await api().get(`/api/shipments/${shipmentId}/events`).set(t.customer)).status).toBe(200);
    const byOrder = await api().get(`/api/orders/${t.order.id}/shipments`).set(asA);
    expect(byOrder.body.data).toEqual([]); // A has no shipments and cannot see B's
  });

  it('walks the fulfilment chain, rejects bad transitions, and derives the parent order status', async () => {
    const t = await twoVendorOrder();
    const A = { id: t.a.vendorUser.id, role: 'VENDOR' };
    const B = { id: t.b.vendorUser.id, role: 'VENDOR' };
    await expect(SubOrderService.updateStatus(A, t.sa.id, { status: 'SHIPPED' })).rejects.toThrow(/Cannot transition/);

    for (const status of ['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED']) {
      await SubOrderService.updateStatus(A, t.sa.id, { status });
    }
    expect((await prisma.order.findUniqueOrThrow({ where: { id: t.order.id } })).status).toBe('PENDING'); // B hasn't started
    await SubOrderService.updateStatus(B, t.sb.id, { status: 'CONFIRMED' });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: t.order.id } })).status).toBe('CONFIRMED');
    for (const status of ['PROCESSING', 'PACKED', 'SHIPPED'])
      await SubOrderService.updateStatus(B, t.sb.id, { status });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: t.order.id } })).status).toBe('SHIPPED');
    await SubOrderService.updateStatus(B, t.sb.id, { status: 'DELIVERED' });
    const done = await prisma.order.findUniqueOrThrow({ where: { id: t.order.id } });
    expect(done.status).toBe('DELIVERED');
    expect((await prisma.subOrder.findUniqueOrThrow({ where: { id: t.sa.id } })).deliveredAt).not.toBeNull();
    // COD cash is considered collected once every vendor has delivered
    const cod = await prisma.payment.findFirst({ where: { orderId: t.order.id, paymentMethod: 'COD' } });
    expect(cod === null || cod.status === 'SUCCESS').toBe(true);
  });

  it('online orders cannot be confirmed by the vendor before the customer has paid', async () => {
    const a = await createCatalogItem({ stock: 5, price: 100 });
    const f = await createFarmerDirect();
    await cartOf(f.user.id, [[a, 1]]);
    const order = await place(f.user.id, f.address.id, { paymentMethod: 'UPI' });
    const so = await subOrderOf(order.id, a.vendor.id);
    await expect(
      SubOrderService.updateStatus({ id: a.vendorUser.id, role: 'VENDOR' }, so.id, { status: 'CONFIRMED' }),
    ).rejects.toThrow(/online payment/);
  });
});

describe('cancel and reject', () => {
  async function walletOrder() {
    const a = await createCatalogItem({ stock: 20, price: 100, vendorState: '09' });
    const b = await createCatalogItem({ stock: 20, price: 100, vendorState: '27' });
    const f = await createFarmerDirect({ walletBalance: 2000 });
    await cartOf(f.user.id, [
      [a, 2],
      [b, 1],
    ]);
    const order = await place(f.user.id, f.address.id, { paymentMethod: 'WALLET' });
    const sa = await subOrderOf(order.id, a.vendor.id);
    const sb = await subOrderOf(order.id, b.vendor.id);
    return { a, b, f, order, sa, sb };
  }

  it('the customer can cancel one sub-order: stock returns, only its share is refunded, the other keeps going', async () => {
    const t = await walletOrder();
    const before = (await prisma.wallet.findUniqueOrThrow({ where: { userId: t.f.user.id } })).balance;
    expect((await prisma.order.findUniqueOrThrow({ where: { id: t.order.id } })).status).toBe('CONFIRMED');

    const res = await SubOrderService.cancelAsCustomer(t.f.user.id, t.sa.id, 'ordered by mistake');
    expect(res.refund).toBe('REFUNDED');
    const after = (await prisma.wallet.findUniqueOrThrow({ where: { userId: t.f.user.id } })).balance;
    expect(s(after.sub(before))).toBe(s(t.sa.totalAmount));
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: t.a.variant.id } })).stockQuantity).toBe(20);
    expect((await prisma.subOrder.findUniqueOrThrow({ where: { id: t.sb.id } })).status).toBe('CONFIRMED');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: t.order.id } })).status).toBe('CONFIRMED');
    expect(await prisma.vendorCommission.count({ where: { subOrderId: t.sa.id } })).toBe(0);
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: t.order.id } });
    expect(payment.status).toBe('PARTIALLY_REFUNDED');

    // cancelling the rest finishes the order
    await SubOrderService.cancelAsCustomer(t.f.user.id, t.sb.id, 'no longer needed');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: t.order.id } })).status).toBe('CANCELLED');
    expect((await prisma.payment.findFirstOrThrow({ where: { orderId: t.order.id } })).status).toBe('REFUNDED');
    expect(s((await prisma.wallet.findUniqueOrThrow({ where: { userId: t.f.user.id } })).balance)).toBe('2000');
  });

  it('a second cancel of the same sub-order does nothing twice', async () => {
    const t = await walletOrder();
    const results = await Promise.allSettled([
      SubOrderService.cancelAsCustomer(t.f.user.id, t.sa.id, 'dup'),
      SubOrderService.cancelAsCustomer(t.f.user.id, t.sa.id, 'dup'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: t.a.variant.id } })).stockQuantity).toBe(20);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: t.f.user.id } });
    expect(s(wallet.balance)).toBe(s(D(2000).sub(t.sa.totalAmount.add(t.sb.totalAmount)).add(t.sa.totalAmount)));
  });

  it('the customer cannot cancel once the seller has started packing; the seller can still reject', async () => {
    const t = await walletOrder();
    const A = { id: t.a.vendorUser.id, role: 'VENDOR' };
    await SubOrderService.updateStatus(A, t.sa.id, { status: 'PROCESSING' });
    await expect(SubOrderService.cancelAsCustomer(t.f.user.id, t.sa.id, 'too late')).rejects.toThrow(
      /cannot be cancelled/,
    );

    await expect(SubOrderService.updateStatus(A, t.sa.id, { status: 'CANCELLED' })).rejects.toThrow(/reason/);
    const res = await SubOrderService.updateStatus(A, t.sa.id, {
      status: 'CANCELLED',
      remarks: 'out of stock at warehouse',
    });
    expect(res.subOrder.status).toBe('CANCELLED');
    expect(res.refund).toBe('REFUNDED');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: t.order.id } })).status).toBe('CONFIRMED');
  });

  it('PACKED or later sub-orders cannot be rejected', async () => {
    const t = await walletOrder();
    const A = { id: t.a.vendorUser.id, role: 'VENDOR' };
    for (const status of ['PROCESSING', 'PACKED']) await SubOrderService.updateStatus(A, t.sa.id, { status });
    await expect(SubOrderService.updateStatus(A, t.sa.id, { status: 'CANCELLED', remarks: 'x' })).rejects.toThrow(
      /Cannot transition/,
    );
  });

  it('cancelling the whole order cancels every cancellable sub-order and skips the shipped one', async () => {
    const t = await walletOrder();
    const A = { id: t.a.vendorUser.id, role: 'VENDOR' };
    for (const status of ['PROCESSING', 'PACKED', 'SHIPPED'])
      await SubOrderService.updateStatus(A, t.sa.id, { status });
    const result = await OrderService.cancel(t.order.id, t.f.user.id, 'changed my mind');
    expect(result.cancelled).toHaveLength(1);
    expect(result.skipped).toBe(1);
    expect((await prisma.subOrder.findUniqueOrThrow({ where: { id: t.sa.id } })).status).toBe('SHIPPED');
    expect((await prisma.subOrder.findUniqueOrThrow({ where: { id: t.sb.id } })).status).toBe('CANCELLED');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: t.order.id } })).status).toBe('SHIPPED');
    await expect(OrderService.cancel(t.order.id, t.f.user.id, 'again')).rejects.toThrow();
  });

  it('khata sub-order cancellation posts a reversing entry for that vendor only and keeps old entries intact', async () => {
    const a = await createCatalogItem({ stock: 10, price: 100, vendorState: '09' });
    const b = await createCatalogItem({ stock: 10, price: 100, vendorState: '09' });
    const f = await createFarmerDirect();
    const ka = await createKhataAccount(a.vendor.id, f.farmer.id, 5000);
    const kb = await createKhataAccount(b.vendor.id, f.farmer.id, 5000);
    await cartOf(f.user.id, [
      [a, 1],
      [b, 1],
    ]);
    const order = await place(f.user.id, f.address.id, { paymentMethod: 'KHATA_CREDIT' });
    const sa = await subOrderOf(order.id, a.vendor.id);
    const entriesBefore = await prisma.khataTransaction.findMany({ where: { khataAccountId: ka.id } });

    await SubOrderService.cancelAsCustomer(f.user.id, sa.id, 'changed my mind');

    const entriesAfter = await prisma.khataTransaction.findMany({
      where: { khataAccountId: ka.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(entriesAfter).toHaveLength(2);
    expect(entriesAfter[0]).toEqual(entriesBefore[0]); // the original debit is untouched
    expect(entriesAfter[1].type).toBe('WAIVER');
    expect(s((await prisma.khataAccount.findUniqueOrThrow({ where: { id: ka.id } })).outstandingAmount)).toBe('0');
    expect(s((await prisma.khataAccount.findUniqueOrThrow({ where: { id: kb.id } })).outstandingAmount)).not.toBe('0');
    expect(await reconcileKhata(ka.id)).toEqual([]);
  });
});

describe('online payment confirms every sub-order', () => {
  it('a verified payment moves all PENDING sub-orders and the parent to CONFIRMED', async () => {
    const { setGatewayForTests, FakeGateway, computeCheckoutSignature, FAKE_GATEWAY_SECRET } =
      await import('../../src/modules/payments/gateway');
    setGatewayForTests(new FakeGateway());
    const { a, b } = await threeVendors();
    const f = await createFarmerDirect();
    await cartOf(f.user.id, [
      [a, 1],
      [b, 1],
    ]);
    const order = await place(f.user.id, f.address.id, { paymentMethod: 'UPI' });
    const auth = bearer(tokenFor(f.user.id));
    const init = (
      await api().post('/api/payments/initiate').set(auth).send({ orderId: order.id, paymentMethod: 'UPI' })
    ).body.data;
    expect(init.gateway.amountPaise).toBe(Number(order.totalAmount.mul(100)));
    const payId = `pay_sub_${randomUUID().slice(0, 8)}`;
    const verified = await api()
      .post('/api/payments/verify')
      .set(auth)
      .send({
        paymentId: init.payment.id,
        razorpay_order_id: init.gateway.gatewayOrderId,
        razorpay_payment_id: payId,
        razorpay_signature: computeCheckoutSignature(FAKE_GATEWAY_SECRET, init.gateway.gatewayOrderId, payId),
      });
    expect(verified.status).toBe(200);
    const subs = await prisma.subOrder.findMany({ where: { orderId: order.id } });
    expect(subs.map((x) => x.status)).toEqual(['CONFIRMED', 'CONFIRMED']);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('CONFIRMED');
    setGatewayForTests(null);
  });
});

describe('address and vendor GST profile', () => {
  it('addresses need a valid state; names are mapped to GST codes', async () => {
    const f = await createFarmerDirect();
    const auth = bearer(tokenFor(f.user.id));
    const base = { addressLine1: '12 Mandi Road', city: 'Pune', pincode: '411001' };
    const noState = await api().post('/api/addresses').set(auth).send(base);
    expect(noState.status).toBe(422);
    const bad = await api()
      .post('/api/addresses')
      .set(auth)
      .send({ ...base, stateCode: '99' });
    expect(bad.status).toBe(422);
    const byName = await api()
      .post('/api/addresses')
      .set(auth)
      .send({ ...base, state: 'maharashtra' });
    expect(byName.status).toBe(201);
    expect(byName.body.data.stateCode).toBe('27');
    expect(byName.body.data.state).toBe('Maharashtra');
    const byCode = await api()
      .post('/api/addresses')
      .set(auth)
      .send({ ...base, stateCode: '29' });
    expect(byCode.body.data.state).toBe('Karnataka');
    const unknownName = await api()
      .post('/api/addresses')
      .set(auth)
      .send({ ...base, state: 'Atlantis' });
    expect(unknownName.status).toBe(400);
  });

  it('vendors set GSTIN and state; a mismatch is refused and the state can come from the GSTIN', async () => {
    const v = await createCatalogItem();
    const auth = bearer(v.vendorUser);
    const mismatch = await api()
      .put('/api/users/me/vendor-profile')
      .set(auth)
      .send({ gstNumber: '27AAPFU0939F1ZV', stateCode: '09' });
    expect(mismatch.status).toBe(422);
    const badGstin = await api().put('/api/users/me/vendor-profile').set(auth).send({ gstNumber: '99AAAAA0000A1Z5' });
    expect(badGstin.status).toBe(422);
    const ok = await api()
      .put('/api/users/me/vendor-profile')
      .set(auth)
      .send({
        gstNumber: `29AAPFU${Math.floor(1000 + Math.random() * 9000)}F1ZV`,
        businessAddress: '5 Industrial Area, Bengaluru',
      });
    expect(ok.status).toBe(200);
    expect(ok.body.data.stateCode).toBe('29');
    expect(ok.body.data.businessAddress).toContain('Bengaluru');
  });
});
