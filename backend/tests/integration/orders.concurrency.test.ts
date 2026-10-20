import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { OrderService } from '../../src/modules/orders/order.service';
import { debitWallet, creditWallet } from '../../src/modules/payments/wallet.ledger';
import { LEDGER_TX_OPTIONS, reconcileKhata } from '../../src/modules/khata/khata.ledger';
import { api, bearer, createCatalogItem, createFarmerDirect, createKhataAccount, fillCart, prisma } from '../helpers';

const D = (v: number | string) => new Prisma.Decimal(v);

type Catalog = Awaited<ReturnType<typeof createCatalogItem>>;

/** One farmer with `qty` of the variant in their cart. */
async function farmerWithCart(catalog: Catalog, qty = 1, walletBalance = 0) {
  const f = await createFarmerDirect({ walletBalance });
  await fillCart(f.user.id, [{ variantId: catalog.variant.id, quantity: qty }]);
  return f;
}

const place = (userId: string, addressId: string, extra: Record<string, unknown> = {}) =>
  OrderService.create(userId, { addressId, paymentMethod: 'COD', ...extra });

const variantNow = (id: string) => prisma.productVariant.findUniqueOrThrow({ where: { id } });

describe('order creation under concurrency', () => {
  it('50 parallel orders for 10 units of stock: exactly 10 succeed and stock never goes negative', async () => {
    const catalog = await createCatalogItem({ stock: 10, price: 100 });
    const farmers = await Promise.all(Array.from({ length: 50 }, () => farmerWithCart(catalog, 1)));

    const results = await Promise.allSettled(farmers.map((f) => place(f.user.id, f.address.id)));
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

    expect(ok).toHaveLength(10);
    expect(failed).toHaveLength(40);
    for (const f of failed) expect(String(f.reason?.message)).toMatch(/Insufficient stock/);

    const v = await variantNow(catalog.variant.id);
    expect(v.stockQuantity).toBe(0);
    expect(v.reservedQty).toBe(0);
    const orderItems = await prisma.orderItem.aggregate({
      where: { variantId: catalog.variant.id },
      _sum: { quantity: true },
    });
    expect(orderItems._sum.quantity).toBe(10);
  });

  it('a failed order rolls everything back (stock, coupon use, cart)', async () => {
    const catalog = await createCatalogItem({ stock: 10, price: 100 });
    const code = `RB-${randomUUID().slice(0, 6)}`;
    const coupon = await prisma.coupon.create({
      data: {
        code,
        title: 'rollback',
        type: 'FIXED',
        value: 10,
        usageLimit: 10,
        startsAt: new Date(Date.now() - 1000),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const f = await farmerWithCart(catalog, 2, 0); // wallet is empty
    await expect(place(f.user.id, f.address.id, { paymentMethod: 'WALLET', couponCode: code })).rejects.toThrow(
      /Insufficient wallet balance/,
    );

    expect((await variantNow(catalog.variant.id)).stockQuantity).toBe(10);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(0);
    expect(await prisma.cartItem.count({ where: { cart: { userId: f.user.id } } })).toBe(1);
    expect(await prisma.order.count({ where: { userId: f.user.id } })).toBe(0);
  });

  it('a coupon with limit 5 is used exactly 5 times by 20 parallel orders', async () => {
    const catalog = await createCatalogItem({ stock: 1000, price: 100 });
    const code = `LIM-${randomUUID().slice(0, 6)}`;
    const coupon = await prisma.coupon.create({
      data: {
        code,
        title: 'limit 5',
        type: 'FIXED',
        value: 10,
        usageLimit: 5,
        startsAt: new Date(Date.now() - 1000),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const farmers = await Promise.all(Array.from({ length: 20 }, () => farmerWithCart(catalog, 1)));
    const results = await Promise.allSettled(farmers.map((f) => place(f.user.id, f.address.id, { couponCode: code })));

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5);
    for (const r of results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')) {
      expect(String(r.reason?.message)).toMatch(/usage limit/);
    }
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(5);
    expect(await prisma.order.count({ where: { couponCode: code } })).toBe(5);
    // 20 attempts, 5 successes: the 15 failures gave their stock back.
    expect((await variantNow(catalog.variant.id)).stockQuantity).toBe(995);
  });

  it('submitting the same cart 5 times at once creates exactly one order', async () => {
    const catalog = await createCatalogItem({ stock: 100, price: 100 });
    const f = await farmerWithCart(catalog, 3);
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => place(f.user.id, f.address.id)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.order.count({ where: { userId: f.user.id } })).toBe(1);
    expect((await variantNow(catalog.variant.id)).stockQuantity).toBe(97);
  });

  it('khata orders respect the credit limit and keep the ledger in sync', async () => {
    const catalog = await createCatalogItem({ stock: 100, price: 100 }); // total per order: 100 + 5 GST + 40 delivery = 145
    const f = await createFarmerDirect();
    const account = await createKhataAccount(catalog.vendor.id, f.farmer.id, 300);

    const outcomes: boolean[] = [];
    for (let i = 0; i < 3; i++) {
      await fillCart(f.user.id, [{ variantId: catalog.variant.id, quantity: 1 }]);
      outcomes.push(
        await place(f.user.id, f.address.id, { paymentMethod: 'KHATA_CREDIT', khataAccountId: account.id }).then(
          () => true,
          () => false,
        ),
      );
    }
    expect(outcomes).toEqual([true, true, false]);

    const fresh = await prisma.khataAccount.findUniqueOrThrow({ where: { id: account.id } });
    expect(fresh.outstandingAmount.toString()).toBe('290');
    expect(fresh.status).toBe('ACTIVE');
    expect(await reconcileKhata(account.id)).toEqual([]);
    // The failed third order did not consume stock.
    expect((await variantNow(catalog.variant.id)).stockQuantity).toBe(98);
  });

  it('khata credit belongs to its farmer and its vendor', async () => {
    const catalog = await createCatalogItem({ stock: 10, price: 100 });
    const other = await createCatalogItem({ stock: 10, price: 100 });
    const owner = await createFarmerDirect();
    const thief = await farmerWithCart(catalog, 1);
    const account = await createKhataAccount(catalog.vendor.id, owner.farmer.id, 10_000);

    await expect(
      place(thief.user.id, thief.address.id, { paymentMethod: 'KHATA_CREDIT', khataAccountId: account.id }),
    ).rejects.toThrow(/Khata account not found/);

    await fillCart(owner.user.id, [{ variantId: other.variant.id, quantity: 1 }]);
    await expect(
      place(owner.user.id, owner.address.id, { paymentMethod: 'KHATA_CREDIT', khataAccountId: account.id }),
    ).rejects.toThrow(/khata vendor/);
    expect(
      (await prisma.khataAccount.findUniqueOrThrow({ where: { id: account.id } })).outstandingAmount.toString(),
    ).toBe('0');
  });

  it('cancelling twice in parallel returns stock and khata credit exactly once', async () => {
    const catalog = await createCatalogItem({ stock: 10, price: 100 });
    const f = await createFarmerDirect();
    const account = await createKhataAccount(catalog.vendor.id, f.farmer.id, 10_000);
    await fillCart(f.user.id, [{ variantId: catalog.variant.id, quantity: 2 }]);
    const order = await place(f.user.id, f.address.id, { paymentMethod: 'KHATA_CREDIT', khataAccountId: account.id });
    expect((await variantNow(catalog.variant.id)).stockQuantity).toBe(8);

    const results = await Promise.allSettled([
      OrderService.cancel(order.id, f.user.id, 'changed my mind'),
      OrderService.cancel(order.id, f.user.id, 'changed my mind'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await variantNow(catalog.variant.id)).stockQuantity).toBe(10);
    expect(
      (await prisma.khataAccount.findUniqueOrThrow({ where: { id: account.id } })).outstandingAmount.toString(),
    ).toBe('0');
    expect(await reconcileKhata(account.id)).toEqual([]);
  });
});

describe('server-side pricing', () => {
  async function checkout(price: number, body: Record<string, unknown> = {}) {
    const catalog = await createCatalogItem({ stock: 10, price });
    const f = await createFarmerDirect();
    await fillCart(f.user.id, [{ variantId: catalog.variant.id, quantity: 1 }]);
    const { sign } = await import('jsonwebtoken');
    const accessToken = sign({ userId: f.user.id, role: 'FARMER' }, process.env.JWT_ACCESS_SECRET!, {
      expiresIn: '5m',
    });
    const res = await api()
      .post('/api/orders')
      .set(bearer({ accessToken }))
      .send({ addressId: f.address.id, paymentMethod: 'COD', ...body });
    return res;
  }

  it('ignores a client-supplied deliveryCharge', async () => {
    const res = await checkout(100, { deliveryCharge: 0 });
    expect(res.status).toBe(201);
    expect(res.body.data.deliveryCharge).toBe('40');
    expect(res.body.data.totalAmount).toBe('145'); // 100 + 5% GST + 40
    const negative = await checkout(100, { deliveryCharge: -500 });
    expect(negative.body.data.totalAmount).toBe('145');
  });

  it('delivery is free from the threshold upwards', async () => {
    const res = await checkout(600);
    expect(res.status).toBe(201);
    expect(res.body.data.deliveryCharge).toBe('0');
    expect(res.body.data.totalAmount).toBe('630'); // 600 + 5% GST
  });
});

describe('wallet under concurrency', () => {
  const tx = <T>(fn: (t: Prisma.TransactionClient) => Promise<T>) => prisma.$transaction(fn, LEDGER_TX_OPTIONS);

  it('50 parallel debits of 10 against a balance of 100: exactly 10 succeed, balance 0, never negative', async () => {
    const f = await createFarmerDirect({ walletBalance: 100 });
    const results = await Promise.allSettled(
      Array.from({ length: 50 }, () => tx((t) => debitWallet(t, f.user.id, D(10)))),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(10);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: f.user.id } });
    expect(wallet.balance.toString()).toBe('0');
    const entries = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries).toHaveLength(10);
    expect(entries.map((e) => Number(e.balanceAfter)).sort((a, b) => b - a)).toEqual([
      90, 80, 70, 60, 50, 40, 30, 20, 10, 0,
    ]);
  });

  it('50 parallel credits add up exactly, and an idempotency key credits once', async () => {
    const f = await createFarmerDirect({ walletBalance: 0 });
    await Promise.all(Array.from({ length: 50 }, () => tx((t) => creditWallet(t, f.user.id, D(10)))));
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        tx((t) => creditWallet(t, f.user.id, D(7), { idempotencyKey: `idem-${f.user.id}` })),
      ),
    );
    expect(results.filter((r) => !r.replayed)).toHaveLength(1);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: f.user.id } });
    expect(wallet.balance.toString()).toBe('507');
  });

  it('the database refuses a negative wallet balance', async () => {
    const f = await createFarmerDirect({ walletBalance: 5 });
    await expect(prisma.wallet.update({ where: { userId: f.user.id }, data: { balance: D(-1) } })).rejects.toThrow();
  });

  it('the database refuses negative stock', async () => {
    const catalog = await createCatalogItem({ stock: 1 });
    await expect(
      prisma.productVariant.update({ where: { id: catalog.variant.id }, data: { stockQuantity: -1 } }),
    ).rejects.toThrow();
    await expect(
      prisma.productVariant.update({ where: { id: catalog.variant.id }, data: { reservedQty: -1 } }),
    ).rejects.toThrow();
  });
});
