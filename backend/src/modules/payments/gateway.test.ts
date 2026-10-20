import crypto from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  FakeGateway,
  FAKE_GATEWAY_SECRET,
  RazorpayGateway,
  computeCheckoutSignature,
  fromPaise,
  getGateway,
  toPaise,
  verifyCheckoutSignature,
} from './gateway';

const D = (v: string | number) => new Prisma.Decimal(v);

describe('toPaise / fromPaise (Decimal math)', () => {
  it('converts exactly, including values that break binary floats', () => {
    expect(toPaise(D('0.1'))).toBe(10);
    expect(toPaise(D('0.29'))).toBe(29); // 0.29 * 100 === 28.999999999999996 in floats
    expect(toPaise(D('1.15'))).toBe(115);
    expect(toPaise(D('19.99'))).toBe(1999);
    expect(toPaise(D('99999.99'))).toBe(9999999);
  });
  it('rounds half-up to whole paise and rejects negatives', () => {
    expect(toPaise(D('10.005'))).toBe(1001);
    expect(() => toPaise(D(-1))).toThrow();
  });
  it('round-trips', () => {
    expect(fromPaise(1999).toString()).toBe('19.99');
    expect(fromPaise('50000').toString()).toBe('500');
    expect(toPaise(fromPaise(12345))).toBe(12345);
  });
});

describe('checkout signature (order_id|payment_id HMAC-SHA256)', () => {
  const secret = 'rzp_secret_fixture';
  // Reference value computed independently with openssl/HMAC for "order_X|pay_Y".
  const expected = crypto.createHmac('sha256', secret).update('order_X|pay_Y').digest('hex');

  it('matches the HMAC fixture', () => {
    expect(computeCheckoutSignature(secret, 'order_X', 'pay_Y')).toBe(expected);
    expect(verifyCheckoutSignature(secret, 'order_X', 'pay_Y', expected)).toBe(true);
  });
  it('rejects tampering with any component, the secret, or a missing value', () => {
    expect(verifyCheckoutSignature(secret, 'order_X', 'pay_Z', expected)).toBe(false);
    expect(verifyCheckoutSignature(secret, 'order_Z', 'pay_Y', expected)).toBe(false);
    expect(verifyCheckoutSignature('other', 'order_X', 'pay_Y', expected)).toBe(false);
    expect(verifyCheckoutSignature(secret, 'order_X', 'pay_Y', '')).toBe(false);
    expect(verifyCheckoutSignature(secret, 'order_X', 'pay_Y', expected.slice(1))).toBe(false);
  });
});

describe('RazorpayGateway (SDK injected, no network)', () => {
  it('creates orders in integer paise with the paymentId in notes', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'order_1', amount: 14500, currency: 'INR' });
    const gw = new RazorpayGateway('rzp_test_k', 's', { orders: { create }, payments: { refund: vi.fn() } });
    const out = await gw.createOrder({
      amount: D('145.00'),
      currency: 'INR',
      receipt: 'KB-2026-000001',
      notes: { paymentId: 'p-1' },
    });
    expect(create).toHaveBeenCalledWith({
      amount: 14500,
      currency: 'INR',
      receipt: 'KB-2026-000001',
      notes: { paymentId: 'p-1' },
    });
    expect(out).toEqual({ gatewayOrderId: 'order_1', amountPaise: 14500, currency: 'INR' });
    expect(gw.publicKeyId).toBe('rzp_test_k');
  });

  it('refunds in paise and maps pending/processed', async () => {
    const refund = vi
      .fn()
      .mockResolvedValueOnce({ id: 'rfnd_1', status: 'processed' })
      .mockResolvedValueOnce({ id: 'rfnd_2', status: 'pending' });
    const gw = new RazorpayGateway('k', 's', { orders: { create: vi.fn() }, payments: { refund } });
    const base = { gatewayPaymentId: 'pay_1', amount: D('50.25'), receipt: 'r', notes: {} };
    expect(await gw.refund(base)).toEqual({ gatewayRefundId: 'rfnd_1', status: 'processed' });
    expect(await gw.refund(base)).toEqual({ gatewayRefundId: 'rfnd_2', status: 'pending' });
    expect(refund).toHaveBeenCalledWith('pay_1', { amount: 5025, receipt: 'r', notes: {} });
  });

  it('verifies checkout signatures with its own secret', () => {
    const gw = new RazorpayGateway('k', 'sek', { orders: { create: vi.fn() }, payments: { refund: vi.fn() } });
    const signature = computeCheckoutSignature('sek', 'order_1', 'pay_1');
    expect(gw.verifyCheckoutSignature({ gatewayOrderId: 'order_1', gatewayPaymentId: 'pay_1', signature })).toBe(true);
    expect(gw.verifyCheckoutSignature({ gatewayOrderId: 'order_1', gatewayPaymentId: 'pay_2', signature })).toBe(false);
  });
});

describe('FakeGateway', () => {
  it('uses a real HMAC with a fixed secret, plus a "fake" shortcut for key-less dev', () => {
    const gw = new FakeGateway();
    const sig = computeCheckoutSignature(FAKE_GATEWAY_SECRET, 'order_a', 'pay_a');
    expect(gw.verifyCheckoutSignature({ gatewayOrderId: 'order_a', gatewayPaymentId: 'pay_a', signature: sig })).toBe(
      true,
    );
    expect(
      gw.verifyCheckoutSignature({ gatewayOrderId: 'order_a', gatewayPaymentId: 'pay_a', signature: 'fake' }),
    ).toBe(false);
    expect(
      gw.verifyCheckoutSignature({ gatewayOrderId: 'order_a', gatewayPaymentId: 'pay_fake_1', signature: 'fake' }),
    ).toBe(true);
  });
});

describe('getGateway', () => {
  it('uses the fake gateway outside production when keys are unset, and refuses in production', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(getGateway({ NODE_ENV: 'development' } as NodeJS.ProcessEnv).name).toBe('fake');
  });
});
