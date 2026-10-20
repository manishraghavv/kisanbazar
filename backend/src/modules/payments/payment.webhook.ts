import crypto from 'crypto';
import { Request, Response } from 'express';
import { PaymentService } from './payment.service';

/**
 * Payment gateway webhooks.
 *
 * Mounted in server.ts with express.raw() BEFORE express.json(), because the
 * HMAC must be computed over the exact bytes the gateway sent. Nothing in the
 * body is trusted until the signature has been verified.
 */

export function verifyRazorpaySignature(rawBody: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret || rawBody.length === 0) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const given = Buffer.from(signature, 'utf8');
  const wanted = Buffer.from(expected, 'utf8');
  return given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
}

interface RazorpayPaymentEntity {
  id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  notes?: { paymentId?: string } | unknown[];
}

interface RazorpayEvent {
  event?: string;
  payload?: { payment?: { entity?: RazorpayPaymentEntity } };
}

const PAID_EVENTS = ['payment.captured', 'order.paid'];

export const handlePaymentWebhook = async (req: Request, res: Response): Promise<void> => {
  const gateway = req.params.gateway;
  if (gateway !== 'razorpay') {
    res.status(400).json({ success: false, message: `Webhooks are not supported for gateway "${gateway}"` });
    return;
  }

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[WEBHOOK] RAZORPAY_WEBHOOK_SECRET is not configured; rejecting webhook');
    res.status(503).json({ success: false, message: 'Webhook not configured' });
    return;
  }

  const rawBody = req.body;
  if (!Buffer.isBuffer(rawBody)) {
    res.status(400).json({ success: false, message: 'Expected raw request body' });
    return;
  }

  const signature = req.headers['x-razorpay-signature'];
  if (!verifyRazorpaySignature(rawBody, Array.isArray(signature) ? signature[0] : signature, secret)) {
    res.status(401).json({ success: false, message: 'Invalid signature' });
    return;
  }

  let event: RazorpayEvent;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    res.status(400).json({ success: false, message: 'Malformed JSON' });
    return;
  }

  if (!event.event || !PAID_EVENTS.includes(event.event)) {
    res.json({ received: true, ignored: 'event_not_handled' });
    return;
  }

  const entity = event.payload?.payment?.entity;
  const notes = entity?.notes && !Array.isArray(entity.notes) ? entity.notes : undefined;
  if (!entity || typeof entity.amount !== 'number') {
    res.json({ received: true, ignored: 'malformed_event' });
    return;
  }

  const result = await PaymentService.confirmCapturedPayment({
    paymentId: notes?.paymentId,
    gatewayOrderId: entity.order_id,
    gatewayPaymentId: entity.id,
    amountPaise: entity.amount,
    currency: entity.currency,
    rawPayload: event,
  });

  res.json({ received: true, ...(result.ignored ? { ignored: result.ignored } : {}) });
};
