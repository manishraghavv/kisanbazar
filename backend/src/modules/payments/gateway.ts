import crypto from 'crypto';
import Razorpay from 'razorpay';
import { Prisma } from '@prisma/client';

/**
 * Payment gateway boundary.
 *
 * Money is Decimal everywhere in the app. It is converted to integer paise ONLY here, with Decimal math
 * (`toPaise`), immediately before it is handed to a gateway; amounts coming back are converted with `fromPaise`.
 *
 * Services depend on the `PaymentGateway` interface, never on the SDK, so tests inject `FakeGateway`
 * (no network) and production uses `RazorpayGateway`.
 */

export interface GatewayOrder {
  gatewayOrderId: string;
  amountPaise: number;
  currency: string;
}

export interface GatewayRefund {
  gatewayRefundId: string;
  /** 'processed' once money has moved; 'pending' when the gateway will confirm later via webhook. */
  status: 'processed' | 'pending';
}

export interface PaymentGateway {
  readonly name: 'razorpay' | 'fake';
  /** Public key id the browser SDK needs (Checkout.js). */
  readonly publicKeyId: string;
  createOrder(input: {
    amount: Prisma.Decimal;
    currency: string;
    receipt: string;
    notes: Record<string, string>;
  }): Promise<GatewayOrder>;
  /** Verifies the signature Checkout.js returns to the browser: HMAC_SHA256(order_id|payment_id). */
  verifyCheckoutSignature(input: { gatewayOrderId: string; gatewayPaymentId: string; signature: string }): boolean;
  refund(input: {
    gatewayPaymentId: string;
    amount: Prisma.Decimal;
    receipt: string;
    notes: Record<string, string>;
  }): Promise<GatewayRefund>;
}

// ── Decimal <-> paise ────────────────────────────────────────────────────────

/** Rupees (Decimal) -> integer paise. Rounds half-up to whole paise; the result is always an integer. */
export function toPaise(rupees: Prisma.Decimal): number {
  const paise = rupees.mul(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
  if (paise.isNegative()) throw new Error('Negative amounts cannot be sent to a gateway');
  if (paise.gt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount too large');
  return paise.toNumber();
}

/** Integer paise -> rupees (Decimal, 2 dp). */
export function fromPaise(paise: number | string | bigint): Prisma.Decimal {
  return new Prisma.Decimal(paise.toString()).div(100).toDecimalPlaces(2);
}

// ── Signatures ───────────────────────────────────────────────────────────────

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function computeCheckoutSignature(secret: string, gatewayOrderId: string, gatewayPaymentId: string): string {
  return crypto.createHmac('sha256', secret).update(`${gatewayOrderId}|${gatewayPaymentId}`).digest('hex');
}

export function verifyCheckoutSignature(
  secret: string,
  gatewayOrderId: string,
  gatewayPaymentId: string,
  signature: string,
): boolean {
  if (!secret || !gatewayOrderId || !gatewayPaymentId || !signature) return false;
  return safeEqualHex(computeCheckoutSignature(secret, gatewayOrderId, gatewayPaymentId), signature);
}

// ── Razorpay ─────────────────────────────────────────────────────────────────

interface RazorpayClientLike {
  orders: { create(body: Record<string, unknown>): Promise<{ id: string; amount: number | string; currency: string }> };
  payments: { refund(paymentId: string, body: Record<string, unknown>): Promise<{ id: string; status?: string }> };
}

export class RazorpayGateway implements PaymentGateway {
  readonly name = 'razorpay' as const;
  private readonly client: RazorpayClientLike;

  constructor(
    private readonly keyId: string,
    private readonly keySecret: string,
    client?: RazorpayClientLike,
  ) {
    this.client = client ?? (new Razorpay({ key_id: keyId, key_secret: keySecret }) as unknown as RazorpayClientLike);
  }

  get publicKeyId(): string {
    return this.keyId;
  }

  async createOrder(input: {
    amount: Prisma.Decimal;
    currency: string;
    receipt: string;
    notes: Record<string, string>;
  }) {
    const amountPaise = toPaise(input.amount);
    const order = await this.client.orders.create({
      amount: amountPaise,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes,
    });
    return { gatewayOrderId: order.id, amountPaise, currency: input.currency };
  }

  verifyCheckoutSignature(input: { gatewayOrderId: string; gatewayPaymentId: string; signature: string }): boolean {
    return verifyCheckoutSignature(this.keySecret, input.gatewayOrderId, input.gatewayPaymentId, input.signature);
  }

  async refund(input: {
    gatewayPaymentId: string;
    amount: Prisma.Decimal;
    receipt: string;
    notes: Record<string, string>;
  }) {
    const refund = await this.client.payments.refund(input.gatewayPaymentId, {
      amount: toPaise(input.amount),
      receipt: input.receipt,
      notes: input.notes,
    });
    return {
      gatewayRefundId: refund.id,
      status: refund.status === 'processed' ? ('processed' as const) : ('pending' as const),
    };
  }
}

// ── Fake (tests and key-less local development) ──────────────────────────────

export const FAKE_GATEWAY_SECRET = 'fake-gateway-secret-for-tests-only';

/** In-memory gateway: no network. Records calls so tests can assert on them. */
export class FakeGateway implements PaymentGateway {
  readonly name = 'fake' as const;
  readonly publicKeyId = 'rzp_test_fake';
  readonly orders: Array<GatewayOrder & { receipt: string; notes: Record<string, string> }> = [];
  readonly refunds: Array<{ gatewayPaymentId: string; amountPaise: number; receipt: string }> = [];
  private seq = 0;
  /** Set to 'pending' to simulate refunds that only the webhook finalises. */
  refundStatus: 'processed' | 'pending' = 'processed';

  async createOrder(input: {
    amount: Prisma.Decimal;
    currency: string;
    receipt: string;
    notes: Record<string, string>;
  }) {
    const order = {
      gatewayOrderId: `order_fake_${++this.seq}_${crypto.randomBytes(4).toString('hex')}`,
      amountPaise: toPaise(input.amount),
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes,
    };
    this.orders.push(order);
    return { gatewayOrderId: order.gatewayOrderId, amountPaise: order.amountPaise, currency: order.currency };
  }

  /** Real HMAC with a fixed secret, plus the literal signature "fake" for the key-less dev flow. */
  verifyCheckoutSignature(input: { gatewayOrderId: string; gatewayPaymentId: string; signature: string }): boolean {
    if (input.signature === 'fake' && input.gatewayPaymentId.startsWith('pay_fake_')) return true;
    return verifyCheckoutSignature(FAKE_GATEWAY_SECRET, input.gatewayOrderId, input.gatewayPaymentId, input.signature);
  }

  async refund(input: {
    gatewayPaymentId: string;
    amount: Prisma.Decimal;
    receipt: string;
    notes: Record<string, string>;
  }) {
    this.refunds.push({
      gatewayPaymentId: input.gatewayPaymentId,
      amountPaise: toPaise(input.amount),
      receipt: input.receipt,
    });
    return {
      gatewayRefundId: `rfnd_fake_${++this.seq}_${crypto.randomBytes(4).toString('hex')}`,
      status: this.refundStatus,
    };
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

let override: PaymentGateway | null = null;
let cached: PaymentGateway | null = null;

/** Tests inject a gateway here. Pass null to restore normal selection. */
export function setGatewayForTests(gateway: PaymentGateway | null): void {
  override = gateway;
}

/**
 * Real Razorpay when RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are set. Without keys: the fake gateway outside
 * production (with a loud log line), and a hard error in production.
 */
export function getGateway(env: NodeJS.ProcessEnv = process.env): PaymentGateway {
  if (override) return override;
  if (cached) return cached;
  const keyId = env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_KEY_SECRET;
  if (keyId && keySecret) {
    cached = new RazorpayGateway(keyId, keySecret);
  } else if (env.NODE_ENV === 'production') {
    throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are required in production');
  } else {
    console.warn('[PAYMENTS] RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET not set: using the FAKE gateway (no real payments).');
    cached = new FakeGateway();
  }
  return cached;
}
