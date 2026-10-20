/**
 * C.3 — Notification Dispatch Service
 *
 * Centralized notification dispatcher that:
 * 1. Sends in-app notification (DB + WebSocket)
 * 2. Enqueues email/SMS/push jobs via BullMQ
 * 3. Falls back to console.log when providers aren't configured
 *
 * Usage:
 *   import { dispatch } from './services/notification-dispatch';
 *   await dispatch.orderUpdate(userId, 'Order #KB-2026-000001 has been shipped!');
 */

import { prisma } from '../lib/prisma';
import { JobQueue } from '../../jobs/queues';
import { getIO } from '../lib/socket';
import { sendSms, isSmsConfigured } from '../lib/sms';
import { sendEmail, isEmailConfigured } from '../lib/email';

// ── Dispatch Configuration ───────────────────────────────────────────────────

const SMS_ENABLED = process.env.SMS_ENABLED === 'true';
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true';
const PUSH_ENABLED = process.env.PUSH_ENABLED === 'true';

// ── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES: Record<string, { title: string; message: string }> = {
  // Orders
  ORDER_PLACED: { title: 'Order Placed', message: 'Your order {{orderNumber}} has been placed successfully.' },
  ORDER_CONFIRMED: { title: 'Order Confirmed', message: 'Your order {{orderNumber}} has been confirmed.' },
  ORDER_SHIPPED: { title: 'Order Shipped', message: 'Your order {{orderNumber}} has been shipped!' },
  ORDER_DELIVERED: { title: 'Order Delivered', message: 'Your order {{orderNumber}} has been delivered.' },
  ORDER_CANCELLED: { title: 'Order Cancelled', message: 'Your order {{orderNumber}} has been cancelled.' },

  // Khata
  KHATA_TRANSACTION: {
    title: 'Khata Update',
    message: 'A transaction of ₹{{amount}} has been recorded in your khata.',
  },
  KHATA_OVERDUE: {
    title: '⚠️ Khata Overdue',
    message: 'Your khata of ₹{{amount}} is overdue. Please pay by {{dueDate}}.',
  },
  KHATA_LIMIT_INCREASED: {
    title: 'Khata Limit Increased',
    message: 'Your khata limit has been increased to ₹{{newLimit}}.',
  },

  // Repayment Reminders (farmer-facing)
  KHATA_DUE_SOON: {
    title: '📋 Khata Due Soon',
    message:
      'Your khata of ₹{{amount}} with {{vendorName}} is due on {{dueDate}} ({{daysRemaining}} day(s) remaining).',
  },
  KHATA_DUE_TOMORROW: {
    title: '⚠️ Khata Due Tomorrow',
    message: 'Your khata of ₹{{amount}} with {{vendorName}} is due TOMORROW ({{dueDate}}). Please arrange payment.',
  },
  KHATA_OVERDUE_REMINDER: {
    title: '🔴 Khata Overdue Reminder',
    message:
      'Your khata of ₹{{amount}} with {{vendorName}} is overdue since {{dueDate}}. Please pay immediately to avoid suspension.',
  },

  // Vendor-facing khata reminders
  KHATA_VENDOR_DUE_SOON: {
    title: '📋 Farmer Khata Due Soon',
    message: 'Khata of {{farmerName}} — ₹{{amount}} is due on {{dueDate}}.',
  },
  KHATA_VENDOR_OVERDUE: {
    title: '🔴 Farmer Khata Overdue',
    message: 'Khata of {{farmerName}} — ₹{{amount}} is overdue since {{dueDate}}.',
  },

  // Wallet
  WALLET_CREDIT: { title: 'Money Added', message: '₹{{amount}} has been added to your wallet.' },
  WALLET_DEBIT: {
    title: 'Payment Made',
    message: '₹{{amount}} has been deducted from your wallet for order {{reference}}.',
  },

  // System
  SYSTEM_ALERT: { title: 'System Alert', message: '{{message}}' },
};

// ── Helper: Replace template variables ───────────────────────────────────────

function fillTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return String(data[key] ?? `{{${key}}}`);
  });
}

// ── Core Dispatch Function ───────────────────────────────────────────────────

async function sendNotification(
  userId: string,
  type: string,
  data: Record<string, unknown>,
  channels?: { email?: boolean; sms?: boolean; push?: boolean },
): Promise<void> {
  // Resolve template
  const template = TEMPLATES[type];
  if (!template) {
    console.warn(`[DISPATCH] Unknown notification type: ${type}`);
    return;
  }

  const title = fillTemplate(template.title, data);
  const message = fillTemplate(template.message, data);

  // 1. Create in-app notification
  const notification = await prisma.notification.create({
    data: { userId, title, message, type },
  });

  // 2. Emit real-time WebSocket event
  const io = getIO();
  if (io) {
    io.to(`user:${userId}`).emit('notification:new', notification);
  }

  // 3. Send SMS — try direct via Twilio first, fall back to JobQueue or dev log
  if (channels?.sms !== false) {
    if (SMS_ENABLED && isSmsConfigured()) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { phoneNumber: true },
      });
      if (user) {
        const prefix = '+91'; // All Indian numbers
        const phone = user.phoneNumber.startsWith('+') ? user.phoneNumber : `${prefix}${user.phoneNumber}`;
        await sendSms(phone, message);
      }
    } else if (SMS_ENABLED) {
      // Queue for async processing
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { phoneNumber: true },
      });
      if (user) {
        await JobQueue.sms({ to: user.phoneNumber, message, templateName: type });
      }
    }
  }

  // 4. Send Email — try direct via Resend first, fall back to JobQueue or dev log
  if (channels?.email !== false) {
    if (EMAIL_ENABLED && isEmailConfigured()) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, fullName: true },
      });
      if (user?.email) {
        await sendEmail(user.email, title, `<p>${message}</p>`);
      }
    } else if (EMAIL_ENABLED) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, fullName: true },
      });
      if (user?.email) {
        await JobQueue.email({
          to: user.email,
          subject: title,
          body: `<p>${message}</p>`,
          templateName: type,
        });
      }
    }
  }

  // 5. Send Push (if enabled)
  if (channels?.push !== false && PUSH_ENABLED) {
    await JobQueue.push({ userId, title, body: message });
  }

  // 6. When no real provider is configured, log for development
  if (!SMS_ENABLED && !EMAIL_ENABLED && !PUSH_ENABLED) {
    console.log(`[DISPATCH][DEV] Notification to user ${userId}: [${type}] ${title} — ${message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Named Dispatch Functions
// ═══════════════════════════════════════════════════════════════════════════════

export const dispatch = {
  // ── Order Notifications ─────────────────────────────────────────────────

  async orderPlaced(userId: string, orderNumber: string) {
    await sendNotification(userId, 'ORDER_PLACED', { orderNumber }, { sms: true });
  },

  async orderConfirmed(userId: string, orderNumber: string) {
    await sendNotification(userId, 'ORDER_CONFIRMED', { orderNumber }, { sms: true });
  },

  async orderShipped(userId: string, orderNumber: string) {
    await sendNotification(userId, 'ORDER_SHIPPED', { orderNumber }, { sms: true });
  },

  async orderDelivered(userId: string, orderNumber: string) {
    await sendNotification(userId, 'ORDER_DELIVERED', { orderNumber }, { sms: true });
  },

  async orderCancelled(userId: string, orderNumber: string) {
    await sendNotification(userId, 'ORDER_CANCELLED', { orderNumber }, { sms: true });
  },

  // ── Khata Notifications ─────────────────────────────────────────────────

  async khataTransaction(userId: string, amount: string) {
    await sendNotification(userId, 'KHATA_TRANSACTION', { amount });
  },

  async khataOverdue(userId: string, amount: string, dueDate: string) {
    await sendNotification(userId, 'KHATA_OVERDUE', { amount, dueDate }, { sms: true });
  },

  async khataLimitIncreased(userId: string, newLimit: string) {
    await sendNotification(userId, 'KHATA_LIMIT_INCREASED', { newLimit });
  },

  // ── Khata Repayment Reminders ──────────────────────────────────────────

  async khataDueSoon(userId: string, amount: string, vendorName: string, dueDate: string, daysRemaining: string) {
    await sendNotification(userId, 'KHATA_DUE_SOON', { amount, vendorName, dueDate, daysRemaining }, { sms: true });
  },

  async khataDueTomorrow(userId: string, amount: string, vendorName: string, dueDate: string) {
    await sendNotification(userId, 'KHATA_DUE_TOMORROW', { amount, vendorName, dueDate }, { sms: true });
  },

  async khataOverdueReminder(userId: string, amount: string, vendorName: string, dueDate: string) {
    await sendNotification(userId, 'KHATA_OVERDUE_REMINDER', { amount, vendorName, dueDate }, { sms: true });
  },

  async khataVendorDueSoon(userId: string, farmerName: string, amount: string, dueDate: string) {
    await sendNotification(userId, 'KHATA_VENDOR_DUE_SOON', { farmerName, amount, dueDate }, { sms: true });
  },

  async khataVendorOverdue(userId: string, farmerName: string, amount: string, dueDate: string) {
    await sendNotification(userId, 'KHATA_VENDOR_OVERDUE', { farmerName, amount, dueDate }, { sms: true });
  },

  // ── Wallet Notifications ────────────────────────────────────────────────

  async walletCredit(userId: string, amount: string) {
    await sendNotification(userId, 'WALLET_CREDIT', { amount });
  },

  async walletDebit(userId: string, amount: string, reference: string) {
    await sendNotification(userId, 'WALLET_DEBIT', { amount, reference });
  },

  // ── System Notifications ────────────────────────────────────────────────

  async systemAlert(userId: string, message: string) {
    await sendNotification(userId, 'SYSTEM_ALERT', { message });
  },
};
