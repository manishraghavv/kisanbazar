/**
 * Central Cron Job Manager
 *
 * All scheduled background tasks run from here.
 * Cron jobs are started on server boot if CRON_ENABLED=true (default: development only).
 *
 * Manual triggers via admin endpoints bypass the cron schedule.
 */

import { prisma } from '../common/lib/prisma';
import { postKhataEntryTx } from '../modules/khata/khata.ledger';
import cron from 'node-cron';
import { dispatch } from '../common/services/notification-dispatch';

// ── Config ───────────────────────────────────────────────────────────────────

const CRON_ENABLED = process.env.CRON_ENABLED !== 'false';
const INTEREST_CRON_SCHEDULE = process.env.CRON_INTEREST_SCHEDULE || '0 0 * * *'; // Daily midnight
const OVERDUE_CRON_SCHEDULE = process.env.CRON_OVERDUE_SCHEDULE || '0 1 * * *'; // Daily 1 AM
const CART_CLEANUP_SCHEDULE = process.env.CRON_CART_CLEANUP_SCHEDULE || '0 3 * * *'; // Daily 3 AM
const PRICE_ALERT_SCHEDULE = process.env.CRON_PRICE_ALERT_SCHEDULE || '0 4 * * *'; // Daily 4 AM
const REPAYMENT_REMINDER_SCHEDULE = process.env.CRON_REPAYMENT_REMINDER_SCHEDULE || '0 8 * * *'; // Daily 8 AM
const GRACE_PERIOD_DAYS = Number(process.env.INTEREST_GRACE_PERIOD_DAYS) || 0;
const OVERDUE_ESCALATION_DAYS = Number(process.env.OVERDUE_ESCALATION_DAYS) || 30;
const OVERDUE_SUSPEND_DAYS = Number(process.env.OVERDUE_SUSPEND_DAYS) || 60;
const CART_EXPIRY_DAYS = Number(process.env.CART_EXPIRY_DAYS) || 7;
const PRICE_ALERT_THRESHOLD_PCT = Number(process.env.PRICE_ALERT_THRESHOLD_PCT) || 5;
const REMINDER_DAYS_BEFORE = Number(process.env.REPAYMENT_REMINDER_DAYS_BEFORE) || 7;

// ── Cron Run Log ─────────────────────────────────────────────────────────────

const cronRuns: Record<
  string,
  { lastRun: Date | null; lastStatus: string; accountsProcessed?: number; errors?: string }
> = {
  interest: { lastRun: null, lastStatus: 'never' },
  overdue: { lastRun: null, lastStatus: 'never' },
  cartCleanup: { lastRun: null, lastStatus: 'never' },
  priceAlert: { lastRun: null, lastStatus: 'never' },
  repaymentReminder: { lastRun: null, lastStatus: 'never' },
};

export function getCronStatus() {
  return cronRuns;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  B.2 — Interest Calculation Cron
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Khata interest.
 *
 *   Rate:     the account's annual `interestRatePct`, charged as a DAILY amount = outstanding x rate / 365 / 100,
 *             rounded to 2 dp. Interest compounds: the base is the whole outstanding balance, including interest
 *             posted on earlier days.
 *   Cadence:  once per account per UTC day. The posting carries the idempotency key `interest:<account>:<yyyy-mm-dd>`,
 *             so re-running the cron (or two instances running it) the same day cannot charge twice. Days on which
 *             the job did not run are NOT back-filled.
 *   Grace:    interest starts once `INTEREST_GRACE_PERIOD_DAYS` full days have passed since the last real
 *             transaction (a debit or a repayment). Interest postings themselves do not count as transactions, so
 *             they never restart the grace period (they used to, which made interest post only once per grace
 *             period instead of daily).
 *   Skipped:  accounts that are not ACTIVE/OVERDUE, owe nothing, or have a 0% rate.
 */
export async function runInterestCalculation(
  opts: { now?: Date; graceDays?: number } = {},
): Promise<{ processed: number; errors: string[] }> {
  const now = opts.now ?? new Date();
  const graceDays = opts.graceDays ?? GRACE_PERIOD_DAYS;
  const errors: string[] = [];
  let processed = 0;

  try {
    // Find all ACTIVE/OVERDUE khata accounts with outstanding > 0
    const accounts = await prisma.khataAccount.findMany({
      where: {
        status: { in: ['ACTIVE', 'OVERDUE'] },
        outstandingAmount: { gt: 0 },
      },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    for (const account of accounts) {
      try {
        // Grace period: skip if within N days of last transaction
        if (graceDays > 0 && account.lastTransactionAt) {
          const daysSinceLastTx = Math.floor(
            (now.getTime() - account.lastTransactionAt.getTime()) / (1000 * 60 * 60 * 24),
          );
          if (daysSinceLastTx < graceDays) continue;
        }

        // Interest = Outstanding × (InterestRatePct / 365 / 100)
        const interestRate = account.interestRatePct;
        if (interestRate.lte(0)) continue; // No interest rate set

        const interestAmount = account.outstandingAmount.mul(interestRate).div(36500).toDecimalPlaces(2); // ÷ 365 ÷ 100
        if (interestAmount.lte(0)) continue;

        // One interest posting per account per UTC day: re-running the cron the same day is a no-op.
        const day = now.toISOString().slice(0, 10);
        const { replayed } = await postKhataEntryTx({
          accountId: account.id,
          type: 'INTEREST_LAGA',
          amount: interestAmount,
          performedById: 'SYSTEM_CRON',
          remarks: `Daily interest @ ${interestRate}% p.a.`,
          idempotencyKey: `interest:${account.id}:${day}`,
          allowedStatuses: ['ACTIVE', 'OVERDUE'],
        });
        if (replayed) continue;

        processed++;
      } catch (err) {
        errors.push(`Account ${account.id}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    errors.push(`Global error: ${(err as Error).message}`);
  }

  cronRuns.interest = {
    lastRun: new Date(),
    lastStatus: errors.length > 0 ? `completed with ${errors.length} errors` : 'success',
    accountsProcessed: processed,
    errors: errors.length > 0 ? errors.join('; ') : undefined,
  };

  return { processed, errors };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  B.3 — Overdue Escalation Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

export async function runOverdueEscalation(): Promise<{
  markedOverdue: number;
  escalated: number;
  suspended: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let markedOverdue = 0;
  let escalated = 0;
  let suspended = 0;

  try {
    const now = new Date();

    // 1. Mark ACTIVE accounts with passed due date as OVERDUE
    const overdueCandidates = await prisma.khataAccount.findMany({
      where: {
        status: 'ACTIVE',
        outstandingAmount: { gt: 0 },
        dueDateNextPayment: { lte: now },
      },
      include: {
        farmer: { select: { userId: true, user: { select: { fullName: true, phoneNumber: true } } } },
        vendor: { select: { userId: true, businessName: true } },
      },
    });

    for (const account of overdueCandidates) {
      try {
        await prisma.khataAccount.update({
          where: { id: account.id },
          data: { status: 'OVERDUE' },
        });

        // Send in-app notification to vendor
        await prisma.notification.create({
          data: {
            userId: account.vendor.userId,
            title: 'Khata Overdue',
            message: `${account.farmer.user.fullName}'s khata of ₹${account.outstandingAmount} is overdue.`,
            type: 'KHATA_REMINDER',
            deepLink: `/khata/${account.id}`,
          },
        });

        markedOverdue++;
      } catch (err) {
        errors.push(`Overdue marking account ${account.id}: ${(err as Error).message}`);
      }
    }

    // 2. Escalate overdue > 30 days to admin
    const escalationDate = new Date(now.getTime() - OVERDUE_ESCALATION_DAYS * 24 * 60 * 60 * 1000);
    const escalatedAccounts = await prisma.khataAccount.findMany({
      where: {
        status: 'OVERDUE',
        dueDateNextPayment: { lte: escalationDate },
      },
      include: {
        vendor: { select: { userId: true, businessName: true } },
      },
    });

    for (const account of escalatedAccounts) {
      try {
        // Notify admin (notify all admin users)
        const admins = await prisma.user.findMany({
          where: { role: 'ADMIN', deletedAt: null },
          select: { id: true },
        });

        for (const admin of admins) {
          await prisma.notification.create({
            data: {
              userId: admin.id,
              title: '⚠️ Khata Overdue Escalation',
              message: `${account.vendor.businessName} has a khata overdue > ${OVERDUE_ESCALATION_DAYS} days. Outstanding: ₹${account.outstandingAmount}`,
              type: 'KHATA_REMINDER',
              deepLink: `/admin/khata/${account.id}`,
            },
          });
        }

        escalated++;
      } catch (err) {
        errors.push(`Escalation account ${account.id}: ${(err as Error).message}`);
      }
    }

    // 3. Auto-suspend overdue > 60 days
    const suspendDate = new Date(now.getTime() - OVERDUE_SUSPEND_DAYS * 24 * 60 * 60 * 1000);
    const suspendAccounts = await prisma.khataAccount.findMany({
      where: {
        status: 'OVERDUE',
        dueDateNextPayment: { lte: suspendDate },
      },
      include: {
        farmer: { select: { userId: true, user: { select: { fullName: true } } } },
        vendor: { select: { userId: true, businessName: true } },
      },
    });

    for (const account of suspendAccounts) {
      try {
        await prisma.khataAccount.update({
          where: { id: account.id },
          data: { status: 'SUSPENDED' },
        });

        // Notify both parties
        for (const notifyUserId of [account.vendor.userId, account.farmer.userId]) {
          await prisma.notification.create({
            data: {
              userId: notifyUserId,
              title: 'Khata Suspended',
              message: `Khata with ${account.farmer.user.fullName} has been suspended due to non-payment > ${OVERDUE_SUSPEND_DAYS} days.`,
              type: 'KHATA_REMINDER',
              deepLink: `/khata/${account.id}`,
            },
          });
        }

        suspended++;
      } catch (err) {
        errors.push(`Suspend account ${account.id}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    errors.push(`Global error: ${(err as Error).message}`);
  }

  cronRuns.overdue = {
    lastRun: new Date(),
    lastStatus: errors.length > 0 ? `completed with ${errors.length} errors` : 'success',
    accountsProcessed: markedOverdue + escalated + suspended,
    errors: errors.length > 0 ? errors.join('; ') : undefined,
  };

  return { markedOverdue, escalated, suspended, errors };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  B.4 — Cart Expiry & Cleanup
// ═══════════════════════════════════════════════════════════════════════════════

export async function runCartCleanup(): Promise<{ deletedCarts: number; releasedStock: number; errors: string[] }> {
  const errors: string[] = [];
  let deletedCarts = 0;
  let releasedStock = 0;

  try {
    const expiryDate = new Date(Date.now() - CART_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    // Find abandoned carts
    const expiredCarts = await prisma.cart.findMany({
      where: {
        updatedAt: { lte: expiryDate },
        items: { some: {} }, // Only carts with items
      },
      include: { items: true },
    });

    for (const cart of expiredCarts) {
      try {
        // Release reserved stock for each item
        for (const item of cart.items) {
          await prisma.productVariant.update({
            where: { id: item.variantId },
            data: { reservedQty: { increment: -item.quantity } },
          });
          releasedStock += item.quantity;
        }

        // Delete cart items and cart
        await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
        await prisma.cart.delete({ where: { id: cart.id } });

        deletedCarts++;
      } catch (err) {
        errors.push(`Cart ${cart.id}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    errors.push(`Global error: ${(err as Error).message}`);
  }

  cronRuns.cartCleanup = {
    lastRun: new Date(),
    lastStatus: errors.length > 0 ? `completed with ${errors.length} errors` : 'success',
    accountsProcessed: deletedCarts,
    errors: errors.length > 0 ? errors.join('; ') : undefined,
  };

  return { deletedCarts, releasedStock, errors };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  B.5 — Khata Repayment Reminders
// ═══════════════════════════════════════════════════════════════════════════════

export async function runRepaymentReminders(): Promise<{ remindersSent: number; errors: string[] }> {
  const errors: string[] = [];
  let remindersSent = 0;

  try {
    const now = new Date();
    const reminderThreshold = new Date(now.getTime() + REMINDER_DAYS_BEFORE * 24 * 60 * 60 * 1000);

    // Find ACTIVE accounts with upcoming due dates (within reminder window) or already overdue
    const accounts = await prisma.khataAccount.findMany({
      where: {
        status: { in: ['ACTIVE', 'OVERDUE'] },
        outstandingAmount: { gt: 0 },
        OR: [
          // Upcoming due within reminder window
          { dueDateNextPayment: { gte: now, lte: reminderThreshold } },
          // Already overdue (will send escalation reminder)
          { dueDateNextPayment: { lt: now }, status: 'OVERDUE' },
        ],
      },
      include: {
        farmer: { select: { userId: true, user: { select: { fullName: true, phoneNumber: true } } } },
        vendor: { select: { userId: true, businessName: true } },
      },
    });

    for (const account of accounts) {
      try {
        const isOverdue = account.status === 'OVERDUE';
        const amountStr = String(account.outstandingAmount);
        const dueDateStr = account.dueDateNextPayment
          ? account.dueDateNextPayment.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
          : 'N/A';
        const daysRemaining = account.dueDateNextPayment
          ? Math.round((account.dueDateNextPayment.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        const vendorName = account.vendor.businessName ?? 'Vendor';
        const farmerName = account.farmer.user.fullName ?? 'Farmer';

        // Notify farmer via dispatch (in-app + WebSocket + SMS/email if configured)
        if (isOverdue) {
          await dispatch.khataOverdueReminder(account.farmer.userId, amountStr, vendorName, dueDateStr);
        } else if (daysRemaining <= 1) {
          await dispatch.khataDueTomorrow(account.farmer.userId, amountStr, vendorName, dueDateStr);
        } else {
          await dispatch.khataDueSoon(account.farmer.userId, amountStr, vendorName, dueDateStr, String(daysRemaining));
        }

        // Notify vendor via dispatch
        if (isOverdue) {
          await dispatch.khataVendorOverdue(account.vendor.userId, farmerName, amountStr, dueDateStr);
        } else {
          await dispatch.khataVendorDueSoon(account.vendor.userId, farmerName, amountStr, dueDateStr);
        }

        remindersSent += 2; // Count farmer + vendor notifications
      } catch (err) {
        errors.push(`Account ${account.id}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    errors.push(`Global error: ${(err as Error).message}`);
  }

  cronRuns.repaymentReminder = {
    lastRun: new Date(),
    lastStatus: errors.length > 0 ? `completed with ${errors.length} errors` : 'success',
    accountsProcessed: remindersSent,
    errors: errors.length > 0 ? errors.join('; ') : undefined,
  };

  return { remindersSent, errors };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  B.6 — Wishlist Price Alerts
// ═══════════════════════════════════════════════════════════════════════════════

export async function runPriceAlerts(): Promise<{ alertsSent: number; errors: string[] }> {
  const errors: string[] = [];
  let alertsSent = 0;

  try {
    // Get all wishlist items with product variant pricing
    const wishlistItems = await prisma.wishlistItem.findMany({
      include: {
        wishlist: { select: { userId: true } },
        product: {
          select: {
            id: true,
            name: true,
            nameHi: true,
            variants: {
              orderBy: { sellingPrice: 'asc' },
              take: 1,
              select: { sellingPrice: true, mrp: true },
            },
          },
        },
      },
    });

    for (const item of wishlistItems) {
      try {
        const currentPrice = item.product.variants[0]?.sellingPrice;
        if (!currentPrice) continue;

        // We can't compare with a historical price without storing it.
        // Strategy: check if the current selling price is significantly
        // lower than the MRP (indicating a sale/discount).
        const mrp = item.product.variants[0]?.mrp;
        if (!mrp || mrp.lte(0)) continue;

        const discountPct = Number(mrp.sub(currentPrice).div(mrp).mul(100));
        if (discountPct >= PRICE_ALERT_THRESHOLD_PCT) {
          // Send notification
          const productName = item.product.nameHi || item.product.name;
          await prisma.notification.create({
            data: {
              userId: item.wishlist.userId,
              title: '🎉 Price Drop Alert!',
              message: `${productName} is now ₹${currentPrice} (${Math.round(discountPct)}% off — was ₹${mrp})`,
              type: 'OFFER',
              deepLink: `/products/${item.product.id}`,
            },
          });

          alertsSent++;
        }
      } catch (err) {
        errors.push(`Wishlist item ${item.id}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    errors.push(`Global error: ${(err as Error).message}`);
  }

  cronRuns.priceAlert = {
    lastRun: new Date(),
    lastStatus: errors.length > 0 ? `completed with ${errors.length} errors` : 'success',
    accountsProcessed: alertsSent,
    errors: errors.length > 0 ? errors.join('; ') : undefined,
  };

  return { alertsSent, errors };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Cron Scheduler — Start all jobs
// ═══════════════════════════════════════════════════════════════════════════════

export function startCronJobs(): void {
  if (!CRON_ENABLED) {
    console.log('[CRON] Cron jobs disabled (CRON_ENABLED=false)');
    return;
  }

  console.log('[CRON] Starting background jobs...');

  // B.2 — Interest Calculation (daily midnight)
  cron.schedule(INTEREST_CRON_SCHEDULE, async () => {
    console.log('[CRON] Running interest calculation...');
    const result = await runInterestCalculation();
    console.log(
      `[CRON] Interest calculation complete: ${result.processed} accounts processed, ${result.errors.length} errors`,
    );
  });

  // B.3 — Overdue Escalation (daily 1 AM)
  cron.schedule(OVERDUE_CRON_SCHEDULE, async () => {
    console.log('[CRON] Running overdue escalation...');
    const result = await runOverdueEscalation();
    console.log(
      `[CRON] Overdue escalation: ${result.markedOverdue} marked, ${result.escalated} escalated, ${result.suspended} suspended`,
    );
  });

  // B.4 — Cart Cleanup (daily 3 AM)
  cron.schedule(CART_CLEANUP_SCHEDULE, async () => {
    console.log('[CRON] Running cart cleanup...');
    const result = await runCartCleanup();
    console.log(`[CRON] Cart cleanup: ${result.deletedCarts} carts deleted, ${result.releasedStock} stock released`);
  });

  // B.5 — Repayment Reminders (daily 8 AM)
  cron.schedule(REPAYMENT_REMINDER_SCHEDULE, async () => {
    console.log('[CRON] Running repayment reminders...');
    const result = await runRepaymentReminders();
    console.log(`[CRON] Repayment reminders: ${result.remindersSent} reminders sent, ${result.errors.length} errors`);
  });

  // B.6 — Price Alerts (daily 4 AM)
  cron.schedule(PRICE_ALERT_SCHEDULE, async () => {
    console.log('[CRON] Running price alerts...');
    const result = await runPriceAlerts();
    console.log(`[CRON] Price alerts: ${result.alertsSent} alerts sent`);
  });

  console.log('[CRON] All background jobs scheduled');
}
