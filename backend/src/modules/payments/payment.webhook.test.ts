import crypto from 'crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./payment.service', () => ({
  PaymentService: { confirmCapturedPayment: vi.fn() },
}));

import { PaymentService } from './payment.service';
import { handlePaymentWebhook, verifyRazorpaySignature } from './payment.webhook';

const SECRET = 'whsec_test_secret';
const sign = (body: Buffer, secret = SECRET) => crypto.createHmac('sha256', secret).update(body).digest('hex');

const capturedEvent = () =>
  Buffer.from(
    JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1', amount: 50000, currency: 'INR', notes: { paymentId: 'p-1' } } } },
    }),
  );

function call(opts: { gateway?: string; body?: unknown; signature?: string }) {
  const req = { params: { gateway: opts.gateway ?? 'razorpay' }, body: opts.body, headers: { 'x-razorpay-signature': opts.signature } } as any;
  const res = {
    statusCode: 200,
    payload: undefined as any,
    status(c: number) { this.statusCode = c; return this; },
    json(p: unknown) { this.payload = p; return this; },
  };
  return handlePaymentWebhook(req, res as any).then(() => res);
}

describe('verifyRazorpaySignature', () => {
  const body = Buffer.from('{"a":1}');
  it('accepts a valid signature', () => expect(verifyRazorpaySignature(body, sign(body), SECRET)).toBe(true));
  it('rejects a wrong secret', () => expect(verifyRazorpaySignature(body, sign(body, 'other'), SECRET)).toBe(false));
  it('rejects a tampered body', () => expect(verifyRazorpaySignature(Buffer.from('{"a":2}'), sign(body), SECRET)).toBe(false));
  it('rejects missing signature, empty body and length mismatch', () => {
    expect(verifyRazorpaySignature(body, undefined, SECRET)).toBe(false);
    expect(verifyRazorpaySignature(Buffer.alloc(0), sign(Buffer.alloc(0)), SECRET)).toBe(false);
    expect(verifyRazorpaySignature(body, 'abc', SECRET)).toBe(false);
  });
});

describe('handlePaymentWebhook', () => {
  beforeEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
    vi.mocked(PaymentService.confirmCapturedPayment).mockReset().mockResolvedValue({});
  });

  it('returns 401 and does not touch payments when the signature is invalid', async () => {
    const body = capturedEvent();
    const res = await call({ body, signature: sign(body, 'attacker') });
    expect(res.statusCode).toBe(401);
    expect(PaymentService.confirmCapturedPayment).not.toHaveBeenCalled();
  });

  it('returns 401 when the signature header is missing', async () => {
    const res = await call({ body: capturedEvent() });
    expect(res.statusCode).toBe(401);
    expect(PaymentService.confirmCapturedPayment).not.toHaveBeenCalled();
  });

  it('fails closed (503) when the webhook secret is not configured', async () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const body = capturedEvent();
    const res = await call({ body, signature: sign(body) });
    expect(res.statusCode).toBe(503);
    expect(PaymentService.confirmCapturedPayment).not.toHaveBeenCalled();
  });

  it('rejects unsupported gateways and non-raw bodies', async () => {
    expect((await call({ gateway: 'payu', body: capturedEvent(), signature: 'x' })).statusCode).toBe(400);
    expect((await call({ body: { already: 'parsed' }, signature: 'x' })).statusCode).toBe(400);
  });

  it('confirms a correctly signed payment.captured event', async () => {
    const body = capturedEvent();
    const res = await call({ body, signature: sign(body) });
    expect(res.statusCode).toBe(200);
    expect(PaymentService.confirmCapturedPayment).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: 'p-1', gatewayOrderId: 'order_1', gatewayPaymentId: 'pay_1', amountPaise: 50000, currency: 'INR' }),
    );
  });

  it('acknowledges but ignores unhandled event types', async () => {
    const body = Buffer.from(JSON.stringify({ event: 'refund.created', payload: {} }));
    const res = await call({ body, signature: sign(body) });
    expect(res.payload).toMatchObject({ received: true, ignored: 'event_not_handled' });
    expect(PaymentService.confirmCapturedPayment).not.toHaveBeenCalled();
  });

  it('surfaces service-level ignores (unknown payment / amount mismatch)', async () => {
    vi.mocked(PaymentService.confirmCapturedPayment).mockResolvedValue({ ignored: 'amount_mismatch' });
    const body = capturedEvent();
    const res = await call({ body, signature: sign(body) });
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({ ignored: 'amount_mismatch' });
  });
});
