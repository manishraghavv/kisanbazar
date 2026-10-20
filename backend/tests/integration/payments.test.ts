import crypto from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  FAKE_GATEWAY_SECRET,
  FakeGateway,
  computeCheckoutSignature,
  setGatewayForTests,
} from '../../src/modules/payments/gateway';
import { OrderService } from '../../src/modules/orders/order.service';
import { api, bearer, createCatalogItem, createFarmerDirect, fillCart, prisma, tokenFor } from '../helpers';

const RUN = crypto.randomBytes(3).toString('hex');
/** Gateway payment ids are globally unique in the DB, so tests must not reuse literals across runs. */
const pay = (n: string) => `pay_${n}_${RUN}`;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET!;

let gateway: FakeGateway;
beforeEach(() => {
  gateway = new FakeGateway();
  setGatewayForTests(gateway);
});
afterAll(() => setGatewayForTests(null));

function sendWebhook(event: unknown, opts: { eventId?: string; secret?: string } = {}) {
  const body = Buffer.from(JSON.stringify(event));
  const signature = crypto
    .createHmac('sha256', opts.secret ?? WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
  const req = api()
    .post('/api/payments/webhook/razorpay')
    .set('Content-Type', 'application/json')
    .set('x-razorpay-signature', signature);
  if (opts.eventId) req.set('x-razorpay-event-id', opts.eventId);
  // A string (not a Buffer): superagent would JSON-encode a Buffer, breaking the signed bytes.
  return req.send(body.toString('utf8'));
}

const capturedEvent = (p: {
  gatewayOrderId: string;
  paymentId: string;
  amountPaise: number;
  gatewayPaymentId?: string;
}) => ({
  event: 'payment.captured',
  payload: {
    payment: {
      entity: {
        id: p.gatewayPaymentId ?? 'pay_' + crypto.randomBytes(5).toString('hex'),
        order_id: p.gatewayOrderId,
        amount: p.amountPaise,
        currency: 'INR',
        method: 'upi',
        notes: { paymentId: p.paymentId },
      },
    },
  },
});

async function farmerWithOrder(paymentMethod: 'UPI' | 'COD' | 'WALLET' = 'UPI', walletBalance = 0) {
  const catalog = await createCatalogItem({ stock: 50, price: 100 }); // total 145 (100 + 5 GST + 40 delivery)
  const f = await createFarmerDirect({ walletBalance });
  await fillCart(f.user.id, [{ variantId: catalog.variant.id, quantity: 1 }]);
  const order = await OrderService.create(f.user.id, { addressId: f.address.id, paymentMethod });
  return { ...f, order, catalog, auth: bearer(tokenFor(f.user.id)) };
}

const walletOf = async (userId: string) => prisma.wallet.findUniqueOrThrow({ where: { userId } });

describe('wallet top-up', () => {
  it('POST /wallet/add-money does NOT credit the wallet', async () => {
    const f = await createFarmerDirect();
    const res = await api()
      .post('/api/wallet/add-money')
      .set(bearer(tokenFor(f.user.id)))
      .send({ amount: 500 });
    expect(res.status).toBe(201);
    expect(res.body.data.gateway.gatewayOrderId).toMatch(/^order_fake_/);
    expect(res.body.data.gateway.amountPaise).toBe(50000);
    expect((await walletOf(f.user.id)).balance.toString()).toBe('0');
    expect(await prisma.walletTransaction.count({ where: { wallet: { userId: f.user.id } } })).toBe(0);
  });

  it('credits only after a valid signature, exactly once even if verify and the webhook both arrive', async () => {
    const f = await createFarmerDirect();
    const auth = bearer(tokenFor(f.user.id));
    const started = await api().post('/api/wallet/add-money').set(auth).send({ amount: 250 });
    const { payment, gateway: gw } = started.body.data;

    // Wrong signature: rejected, nothing credited.
    const bad = await api()
      .post('/api/payments/verify')
      .set(auth)
      .send({
        paymentId: payment.id,
        razorpay_order_id: gw.gatewayOrderId,
        razorpay_payment_id: 'pay_1_' + payment.id,
        razorpay_signature: 'deadbeef',
      });
    expect(bad.status).toBe(400);
    expect((await walletOf(f.user.id)).balance.toString()).toBe('0');

    // A signature for a DIFFERENT gateway order does not unlock this payment.
    const foreign = computeCheckoutSignature(FAKE_GATEWAY_SECRET, 'order_other', 'pay_1');
    const wrongOrder = await api()
      .post('/api/payments/verify')
      .set(auth)
      .send({
        paymentId: payment.id,
        razorpay_order_id: 'order_other',
        razorpay_payment_id: 'pay_1_' + payment.id,
        razorpay_signature: foreign,
      });
    expect(wrongOrder.status).toBe(400);

    const signature = computeCheckoutSignature(FAKE_GATEWAY_SECRET, gw.gatewayOrderId, pay('ok1'));
    const verifyBody = {
      paymentId: payment.id,
      razorpay_order_id: gw.gatewayOrderId,
      razorpay_payment_id: pay('ok1'),
      razorpay_signature: signature,
    };
    const [v1, v2] = await Promise.all([
      api().post('/api/payments/verify').set(auth).send(verifyBody),
      api().post('/api/payments/verify').set(auth).send(verifyBody),
    ]);
    expect(v1.status).toBe(200);
    expect(v2.status).toBe(200);

    const hook = await sendWebhook(
      capturedEvent({
        gatewayOrderId: gw.gatewayOrderId,
        paymentId: payment.id,
        amountPaise: 25000,
        gatewayPaymentId: pay('ok1'),
      }),
    );
    expect(hook.status).toBe(200);

    expect((await walletOf(f.user.id)).balance.toString()).toBe('250');
    expect(await prisma.walletTransaction.count({ where: { wallet: { userId: f.user.id }, type: 'CREDIT' } })).toBe(1);
  });

  it("a user cannot verify someone else's top-up", async () => {
    const owner = await createFarmerDirect();
    const other = await createFarmerDirect();
    const started = await api()
      .post('/api/wallet/add-money')
      .set(bearer(tokenFor(owner.user.id)))
      .send({ amount: 100 });
    const { payment, gateway: gw } = started.body.data;
    const res = await api()
      .post('/api/payments/verify')
      .set(bearer(tokenFor(other.user.id)))
      .send({
        paymentId: payment.id,
        razorpay_order_id: gw.gatewayOrderId,
        razorpay_payment_id: pay('x'),
        razorpay_signature: computeCheckoutSignature(FAKE_GATEWAY_SECRET, gw.gatewayOrderId, pay('x')),
      });
    expect(res.status).toBe(404);
  });

  it('the webhook alone can credit (browser closed before verify)', async () => {
    const f = await createFarmerDirect();
    const started = await api()
      .post('/api/wallet/add-money')
      .set(bearer(tokenFor(f.user.id)))
      .send({ amount: 75 });
    const { payment, gateway: gw } = started.body.data;
    const res = await sendWebhook(
      capturedEvent({ gatewayOrderId: gw.gatewayOrderId, paymentId: payment.id, amountPaise: 7500 }),
    );
    expect(res.status).toBe(200);
    expect((await walletOf(f.user.id)).balance.toString()).toBe('75');
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).paymentMethod).toBe('UPI');
  });

  it('rejects an amount mismatch from the webhook', async () => {
    const f = await createFarmerDirect();
    const started = await api()
      .post('/api/wallet/add-money')
      .set(bearer(tokenFor(f.user.id)))
      .send({ amount: 100 });
    const { payment, gateway: gw } = started.body.data;
    const res = await sendWebhook(
      capturedEvent({ gatewayOrderId: gw.gatewayOrderId, paymentId: payment.id, amountPaise: 100 }),
    );
    expect(res.body.ignored).toBe('amount_mismatch');
    expect((await walletOf(f.user.id)).balance.toString()).toBe('0');
  });
});

describe('webhooks', () => {
  it('rejects a bad signature', async () => {
    const res = await sendWebhook({ event: 'payment.captured' }, { secret: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('a redelivered event id is processed once', async () => {
    const f = await createFarmerDirect();
    const started = await api()
      .post('/api/wallet/add-money')
      .set(bearer(tokenFor(f.user.id)))
      .send({ amount: 40 });
    const { payment, gateway: gw } = started.body.data;
    const event = capturedEvent({ gatewayOrderId: gw.gatewayOrderId, paymentId: payment.id, amountPaise: 4000 });
    const eventId = 'evt_' + crypto.randomBytes(6).toString('hex');
    const results = await Promise.all(Array.from({ length: 5 }, () => sendWebhook(event, { eventId })));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(results.filter((r) => r.body.duplicate)).toHaveLength(4);
    expect((await walletOf(f.user.id)).balance.toString()).toBe('40');
    expect(await prisma.paymentWebhookEvent.count({ where: { eventId } })).toBe(1);
  });

  it('payment.failed marks a pending payment failed and leaves the order payable', async () => {
    const t = await farmerWithOrder('UPI');
    const init = await api()
      .post('/api/payments/initiate')
      .set(t.auth)
      .send({ orderId: t.order.id, paymentMethod: 'UPI' });
    expect(init.status).toBe(201);
    const { payment, gateway: gw } = init.body.data;
    await sendWebhook({
      event: 'payment.failed',
      payload: { payment: { entity: { id: pay('f'), order_id: gw.gatewayOrderId, notes: { paymentId: payment.id } } } },
    });
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('FAILED');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: t.order.id } })).status).toBe('PENDING');

    // Retry: a fresh gateway order is created and can succeed.
    const retry = await api()
      .post('/api/payments/initiate')
      .set(t.auth)
      .send({ orderId: t.order.id, paymentMethod: 'UPI' });
    expect(retry.status).toBe(201);
    expect(retry.body.data.payment.id).not.toBe(payment.id);
  });
});

describe('order payments through the gateway', () => {
  it('initiate creates a gateway order in paise with the paymentId in notes; verify confirms the order', async () => {
    const t = await farmerWithOrder('UPI');
    const init = await api()
      .post('/api/payments/initiate')
      .set(t.auth)
      .send({ orderId: t.order.id, paymentMethod: 'UPI' });
    expect(init.status).toBe(201);
    const { payment, gateway: gw } = init.body.data;
    expect(gw.amountPaise).toBe(14500);
    const created = gateway.orders.find((o) => o.gatewayOrderId === gw.gatewayOrderId)!;
    expect(created.notes.paymentId).toBe(payment.id);
    expect(created.amountPaise).toBe(14500);

    // Re-initiating reuses the open gateway order.
    const again = await api()
      .post('/api/payments/initiate')
      .set(t.auth)
      .send({ orderId: t.order.id, paymentMethod: 'UPI' });
    expect(again.body.data.gateway.gatewayOrderId).toBe(gw.gatewayOrderId);
    expect(gateway.orders).toHaveLength(1);

    const verified = await api()
      .post('/api/payments/verify')
      .set(t.auth)
      .send({
        paymentId: payment.id,
        razorpay_order_id: gw.gatewayOrderId,
        razorpay_payment_id: pay('abc'),
        razorpay_signature: computeCheckoutSignature(FAKE_GATEWAY_SECRET, gw.gatewayOrderId, pay('abc')),
      });
    expect(verified.status).toBe(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: t.order.id } })).status).toBe('CONFIRMED');
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).gatewayPaymentId).toBe(pay('abc'));
  });

  it('one gateway payment id cannot confirm two payments', async () => {
    const a = await farmerWithOrder('UPI');
    const b = await farmerWithOrder('UPI');
    const ia = (
      await api().post('/api/payments/initiate').set(a.auth).send({ orderId: a.order.id, paymentMethod: 'UPI' })
    ).body.data;
    const ib = (
      await api().post('/api/payments/initiate').set(b.auth).send({ orderId: b.order.id, paymentMethod: 'UPI' })
    ).body.data;
    const verify = (t: typeof a, i: typeof ia) =>
      api()
        .post('/api/payments/verify')
        .set(t.auth)
        .send({
          paymentId: i.payment.id,
          razorpay_order_id: i.gateway.gatewayOrderId,
          razorpay_payment_id: pay('same'),
          razorpay_signature: computeCheckoutSignature(FAKE_GATEWAY_SECRET, i.gateway.gatewayOrderId, pay('same')),
        });
    expect((await verify(a, ia)).status).toBe(200);
    expect((await verify(b, ib)).status).toBeGreaterThanOrEqual(400); // unique(gatewayPaymentId) rolls the second back
    expect((await prisma.order.findUniqueOrThrow({ where: { id: b.order.id } })).status).toBe('PENDING');
  });
});

describe('wallet payment is idempotent across flows', () => {
  it('checkout + /payments/initiate + /wallet/pay (in parallel) debit the wallet exactly once', async () => {
    const t = await farmerWithOrder('WALLET', 1000); // total 145 debited at checkout
    expect((await walletOf(t.user.id)).balance.toString()).toBe('855');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: t.order.id } })).status).toBe('CONFIRMED');

    const calls = await Promise.all([
      api().post('/api/payments/initiate').set(t.auth).send({ orderId: t.order.id, paymentMethod: 'WALLET' }),
      api().post('/api/payments/initiate').set(t.auth).send({ orderId: t.order.id, paymentMethod: 'WALLET' }),
      api().post('/api/wallet/pay').set(t.auth).send({ orderId: t.order.id, amount: 145 }),
      api().post('/api/wallet/pay').set(t.auth).send({ orderId: t.order.id }),
    ]);
    expect(calls.map((c) => c.status).every((s) => s < 300)).toBe(true);
    expect((await walletOf(t.user.id)).balance.toString()).toBe('855');
    expect(await prisma.walletTransaction.count({ where: { wallet: { userId: t.user.id }, type: 'DEBIT' } })).toBe(1);
    expect(await prisma.payment.count({ where: { orderId: t.order.id } })).toBe(1);
  });

  it('an order created as UPI and then paid from the wallet by 5 parallel requests debits once', async () => {
    const t = await farmerWithOrder('UPI');
    await prisma.wallet.update({ where: { userId: t.user.id }, data: { balance: 1000 } });
    const calls = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        api().post('/api/wallet/pay').set(t.auth).send({ orderId: t.order.id, amount: 145 }),
      ),
    );
    expect(calls.every((c) => c.status === 'fulfilled' && c.value.status < 300)).toBe(true);
    expect((await walletOf(t.user.id)).balance.toString()).toBe('855');
    expect(await prisma.payment.count({ where: { orderId: t.order.id, status: 'SUCCESS' } })).toBe(1);
  });

  it('refuses a mismatching amount', async () => {
    const t = await farmerWithOrder('UPI');
    const res = await api().post('/api/wallet/pay').set(t.auth).send({ orderId: t.order.id, amount: 1 });
    expect(res.status).toBe(400);
  });
});

describe('refunds through the gateway', () => {
  async function paidOnline() {
    const t = await farmerWithOrder('UPI');
    const init = (
      await api().post('/api/payments/initiate').set(t.auth).send({ orderId: t.order.id, paymentMethod: 'UPI' })
    ).body.data;
    await api()
      .post('/api/payments/verify')
      .set(t.auth)
      .send({
        paymentId: init.payment.id,
        razorpay_order_id: init.gateway.gatewayOrderId,
        razorpay_payment_id: 'pay_' + crypto.randomBytes(4).toString('hex'),
        razorpay_signature: computeCheckoutSignature(FAKE_GATEWAY_SECRET, init.gateway.gatewayOrderId, ''),
      });
    return { t, paymentId: init.payment.id as string, gwOrder: init.gateway.gatewayOrderId as string };
  }

  async function paidAndVerified() {
    const t = await farmerWithOrder('UPI');
    const init = (
      await api().post('/api/payments/initiate').set(t.auth).send({ orderId: t.order.id, paymentMethod: 'UPI' })
    ).body.data;
    const payId = 'pay_' + crypto.randomBytes(4).toString('hex');
    const v = await api()
      .post('/api/payments/verify')
      .set(t.auth)
      .send({
        paymentId: init.payment.id,
        razorpay_order_id: init.gateway.gatewayOrderId,
        razorpay_payment_id: payId,
        razorpay_signature: computeCheckoutSignature(FAKE_GATEWAY_SECRET, init.gateway.gatewayOrderId, payId),
      });
    expect(v.status).toBe(200);
    const admin = bearer(
      tokenFor(
        (
          await prisma.user.create({
            data: {
              fullName: 'Admin',
              phoneNumber: '8' + String(Date.now()).slice(-9),
              role: 'ADMIN',
              isPhoneVerified: true,
            },
          })
        ).id,
        'ADMIN',
      ),
    );
    return { t, paymentId: init.payment.id as string, payId, admin };
  }

  it('refunds via the gateway in paise, partially then fully, never beyond the payment', async () => {
    void paidOnline; // (kept for readability of the helper above)
    const { paymentId, payId, admin } = await paidAndVerified();

    const part = await api()
      .post(`/api/payments/${paymentId}/refund`)
      .set(admin)
      .send({ amount: 45.5, idempotencyKey: 'r1-' + paymentId });
    expect(part.status).toBe(200);
    expect(gateway.refunds).toEqual([expect.objectContaining({ gatewayPaymentId: payId, amountPaise: 4550 })]);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe('PARTIALLY_REFUNDED');

    // Same idempotency key: no second gateway call.
    const again = await api()
      .post(`/api/payments/${paymentId}/refund`)
      .set(admin)
      .send({ amount: 45.5, idempotencyKey: 'r1-' + paymentId });
    expect(again.status).toBe(200);
    expect(gateway.refunds).toHaveLength(1);

    const tooMuch = await api().post(`/api/payments/${paymentId}/refund`).set(admin).send({ amount: 100 });
    expect(tooMuch.status).toBe(400);

    const rest = await api().post(`/api/payments/${paymentId}/refund`).set(admin).send({});
    expect(rest.status).toBe(200);
    expect(gateway.refunds[1].amountPaise).toBe(10000 + 4500 - 4550);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe('REFUNDED');

    const nothing = await api().post(`/api/payments/${paymentId}/refund`).set(admin).send({});
    expect(nothing.status).toBe(400);
  });

  it('a pending gateway refund is finalised by the refund.processed webhook', async () => {
    gateway.refundStatus = 'pending';
    const { paymentId, admin } = await paidAndVerified();
    const res = await api().post(`/api/payments/${paymentId}/refund`).set(admin).send({ amount: 20 });
    expect(res.status).toBe(200);
    const refund = await prisma.refunds.findFirstOrThrow({ where: { paymentId } });
    expect(refund.status).toBe('PENDING');

    const hook = await sendWebhook({
      event: 'refund.processed',
      payload: { refund: { entity: { id: refund.gatewayRefundId } } },
    });
    expect(hook.status).toBe(200);
    const done = await prisma.refunds.findUniqueOrThrow({ where: { id: refund.id } });
    expect(done.status).toBe('PROCESSED');
    expect(done.processedAt).not.toBeNull();
  });

  it('only admins can refund', async () => {
    const { t, paymentId } = await paidAndVerified();
    const res = await api().post(`/api/payments/${paymentId}/refund`).set(t.auth).send({});
    expect(res.status).toBe(403);
  });
});

beforeAll(() => undefined);
