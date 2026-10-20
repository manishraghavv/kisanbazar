import crypto from 'crypto';
import { Request, Response } from 'express';
import { prisma } from '../../common/lib/prisma';
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
  method?: string;
  notes?: { paymentId?: string } | unknown[];
}

interface RazorpayRefundEntity {
  id?: string;
}

interface RazorpayEvent {
  event?: string;
  payload?: { payment?: { entity?: RazorpayPaymentEntity }; refund?: { entity?: RazorpayRefundEntity } };
}

const PAID_EVENTS = ['payment.captured', 'order.paid'];

function paymentIdFromNotes(entity?: RazorpayPaymentEntity): string | undefined {
  const notes = entity?.notes && !Array.isArray(entity.notes) ? entity.notes : undefined;
  return notes?.paymentId;
}

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
  if (!event.event) {
    res.json({ received: true, ignored: 'event_not_handled' });
    return;
  }

  // Razorpay sends a unique id per event in x-razorpay-event-id; fall back to a hash of the signed body.
  const header = req.headers['x-razorpay-event-id'];
  const eventId =
    (Array.isArray(header) ? header[0] : header) || `body:${crypto.createHash('sha256').update(rawBody).digest('hex')}`;
  const eventType = event.event;
  const payment = event.payload?.payment?.entity;
  const refund = event.payload?.refund?.entity;

  // Everything runs in ONE transaction together with the event-id insert: a redelivered event is a no-op, and a
  // crash half-way rolls the insert back so the gateway's retry is processed normally.
  const outcome = await prisma.$transaction(async (tx) => {
    const inserted = await tx.$executeRaw`
      INSERT INTO "payment_webhook_events" ("id", "eventId", "gateway", "eventType", "payload")
      VALUES (${crypto.randomUUID()}, ${eventId}, 'razorpay', ${eventType}, ${JSON.stringify(event)}::jsonb)
      ON CONFLICT ("eventId") DO NOTHING`;
    if (inserted === 0) return { duplicate: true as const };

    if (PAID_EVENTS.includes(eventType)) {
      if (!payment || typeof payment.amount !== 'number') return { ignored: 'malformed_event' };
      return PaymentService.confirmCapturedPayment(tx, {
        paymentId: paymentIdFromNotes(payment),
        gatewayOrderId: payment.order_id,
        gatewayPaymentId: payment.id,
        amountPaise: payment.amount,
        currency: payment.currency,
        method: payment.method,
        rawPayload: event,
      });
    }
    if (eventType === 'payment.failed') {
      if (!payment) return { ignored: 'malformed_event' };
      return PaymentService.markPaymentFailed(tx, {
        paymentId: paymentIdFromNotes(payment),
        gatewayOrderId: payment.order_id,
        rawPayload: event,
      });
    }
    if (eventType === 'refund.processed' || eventType === 'refund.failed') {
      if (!refund?.id) return { ignored: 'malformed_event' };
      return PaymentService.finalizeRefund(tx, { gatewayRefundId: refund.id, failed: eventType === 'refund.failed' });
    }
    return { ignored: 'event_not_handled' };
  });

  if ('duplicate' in outcome) {
    res.json({ received: true, duplicate: true });
    return;
  }
  res.json({ received: true, ...('ignored' in outcome && outcome.ignored ? { ignored: outcome.ignored } : {}) });
};
