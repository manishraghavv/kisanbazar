import { KhataStatus, KhataTransaction, KhataTransactionType, Prisma } from '@prisma/client';
import { prisma } from '../../common/lib/prisma';
import { BadRequestError, NotFoundError } from '../../common/errors';

/**
 * The only code path that changes `KhataAccount.outstandingAmount`.
 *
 * Every posting runs inside the caller's interactive transaction, takes a row lock on the account
 * (`SELECT … FOR UPDATE`), computes `balanceAfter` from the locked row, and writes the ledger entry and the
 * new balance together. Concurrent postings to one account therefore serialize and can never lose an update.
 *
 * Never call `prisma.*` (the global client) from inside a posting transaction: use `tx`. A second connection
 * waiting on the same row would starve the pool.
 */

export const DEBIT_TYPES: ReadonlySet<KhataTransactionType> = new Set(['UDHAR_DIYA', 'INTEREST_LAGA', 'ORDER_LINKED']);

/** Types that raise the balance and must respect the credit limit. Interest may exceed the limit. */
const LIMIT_ENFORCED_TYPES: ReadonlySet<KhataTransactionType> = new Set(['UDHAR_DIYA', 'ORDER_LINKED']);

/** Types that restart the repayment clock (interest must not push the due date out). */
const DUE_DATE_RESETTING_TYPES: ReadonlySet<KhataTransactionType> = new Set(['UDHAR_DIYA', 'ORDER_LINKED']);

export const LEDGER_TX_OPTIONS = { maxWait: 15_000, timeout: 30_000 } as const;

export interface PostKhataEntryInput {
  accountId: string;
  type: KhataTransactionType;
  amount: Prisma.Decimal;
  performedById: string;
  /** A repeated key returns the original entry instead of posting again. */
  idempotencyKey?: string;
  linkedOrderId?: string;
  remarks?: string;
  proofImageUrl?: string;
  upiTransactionId?: string;
  /** Account statuses that may receive this posting (checked under the lock). */
  allowedStatuses?: KhataStatus[];
  /**
   * Credits larger than the outstanding balance are rejected by default (the balance cannot go negative).
   * With `clampCredit` the credit is reduced to the outstanding balance instead (used when reversing an order
   * whose credit was partly repaid already); the entry records the amount actually applied.
   */
  clampCredit?: boolean;
}

export interface PostKhataEntryResult {
  /** Null only when `clampCredit` reduced the credit to zero (nothing was owed), so nothing was posted. */
  transaction: KhataTransaction | null;
  outstandingAmount: Prisma.Decimal;
  replayed: boolean;
}

const DEFAULT_ALLOWED: Record<'debit' | 'credit', KhataStatus[]> = {
  debit: ['ACTIVE', 'OVERDUE', 'SETTLED'],
  credit: ['ACTIVE', 'OVERDUE', 'SETTLED'],
};

export async function postKhataEntry(
  tx: Prisma.TransactionClient,
  input: PostKhataEntryInput,
): Promise<PostKhataEntryResult> {
  if (!input.amount.gt(0)) throw new BadRequestError('Amount must be greater than zero');

  // Lock first: everything below sees (and extends) the latest committed state of this account.
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "khata_accounts" WHERE "id" = ${input.accountId} FOR UPDATE`;
  if (locked.length === 0) throw new NotFoundError('Khata account not found');

  if (input.idempotencyKey) {
    const existing = await tx.khataTransaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.khataAccountId !== input.accountId) {
        throw new BadRequestError('Idempotency key was already used for a different account');
      }
      const account = await tx.khataAccount.findUniqueOrThrow({ where: { id: input.accountId } });
      return { transaction: existing, outstandingAmount: account.outstandingAmount, replayed: true };
    }
  }

  const account = await tx.khataAccount.findUniqueOrThrow({ where: { id: input.accountId } });
  const isDebit = DEBIT_TYPES.has(input.type);

  const allowed = input.allowedStatuses ?? DEFAULT_ALLOWED[isDebit ? 'debit' : 'credit'];
  if (!allowed.includes(account.status)) {
    throw new BadRequestError(`Cannot add transaction to a ${account.status.toLowerCase()} account`);
  }

  let amount = input.amount;
  if (!isDebit && amount.gt(account.outstandingAmount)) {
    if (!input.clampCredit) {
      throw new BadRequestError(`Amount exceeds the outstanding balance of ₹${account.outstandingAmount}`);
    }
    amount = account.outstandingAmount;
    if (amount.lte(0)) return { transaction: null, outstandingAmount: account.outstandingAmount, replayed: false };
  }

  const newOutstanding = isDebit ? account.outstandingAmount.add(amount) : account.outstandingAmount.sub(amount);

  if (isDebit && LIMIT_ENFORCED_TYPES.has(input.type) && newOutstanding.gt(account.creditLimitAmount)) {
    throw new BadRequestError(`Transaction would exceed credit limit of ₹${account.creditLimitAmount}`);
  }

  const now = new Date();
  const transaction = await tx.khataTransaction.create({
    data: {
      khataAccountId: input.accountId,
      type: input.type,
      amount,
      balanceAfter: newOutstanding,
      linkedOrderId: input.linkedOrderId,
      performedById: input.performedById,
      remarks: input.remarks,
      proofImageUrl: input.proofImageUrl,
      upiTransactionId: input.upiTransactionId,
      idempotencyKey: input.idempotencyKey,
    },
  });

  await tx.khataAccount.update({
    where: { id: input.accountId },
    data: {
      outstandingAmount: newOutstanding,
      lastTransactionAt: now,
      status: nextStatus(account.status, newOutstanding),
      ...(DUE_DATE_RESETTING_TYPES.has(input.type)
        ? { dueDateNextPayment: new Date(now.getTime() + account.creditPeriodDays * 24 * 60 * 60 * 1000) }
        : {}),
    },
  });

  return { transaction, outstandingAmount: newOutstanding, replayed: false };
}

/**
 * A posting only moves an account between ACTIVE and SETTLED. It never overwrites OVERDUE or SUSPENDED
 * (those are owned by the overdue pipeline and by humans), and a zero balance only settles an open account.
 */
export function nextStatus(current: KhataStatus, newOutstanding: Prisma.Decimal): KhataStatus {
  if (current === 'ACTIVE' || current === 'SETTLED') return newOutstanding.lte(0) ? 'SETTLED' : 'ACTIVE';
  if (current === 'OVERDUE' && newOutstanding.lte(0)) return 'SETTLED';
  return current;
}

/** Convenience wrapper that opens its own interactive transaction. */
export function postKhataEntryTx(input: PostKhataEntryInput): Promise<PostKhataEntryResult> {
  return prisma.$transaction((tx) => postKhataEntry(tx, input), LEDGER_TX_OPTIONS);
}

// ── Reconciliation ───────────────────────────────────────────────────────────

export interface KhataReconciliationRow {
  accountId: string;
  outstandingAmount: Prisma.Decimal;
  ledgerBalance: Prisma.Decimal;
  difference: Prisma.Decimal;
}

/**
 * Compares each account's stored `outstandingAmount` with the signed sum of its ledger entries
 * (debits − credits). Returns only the accounts that disagree. Read-only.
 */
export async function reconcileKhata(accountId?: string): Promise<KhataReconciliationRow[]> {
  const rows = await prisma.$queryRaw<
    Array<{ accountId: string; outstandingAmount: Prisma.Decimal; ledgerBalance: Prisma.Decimal }>
  >`
    SELECT a."id" AS "accountId",
           a."outstandingAmount" AS "outstandingAmount",
           COALESCE(SUM(CASE WHEN t."type" IN ('UDHAR_DIYA', 'INTEREST_LAGA', 'ORDER_LINKED') THEN t."amount" ELSE -t."amount" END), 0) AS "ledgerBalance"
    FROM "khata_accounts" a
    LEFT JOIN "khata_transactions" t ON t."khataAccountId" = a."id"
    WHERE (${accountId ?? null}::text IS NULL OR a."id" = ${accountId ?? null})
    GROUP BY a."id", a."outstandingAmount"
    HAVING a."outstandingAmount" <> COALESCE(SUM(CASE WHEN t."type" IN ('UDHAR_DIYA', 'INTEREST_LAGA', 'ORDER_LINKED') THEN t."amount" ELSE -t."amount" END), 0)`;
  return rows.map((r) => ({
    accountId: r.accountId,
    outstandingAmount: new Prisma.Decimal(r.outstandingAmount),
    ledgerBalance: new Prisma.Decimal(r.ledgerBalance),
    difference: new Prisma.Decimal(r.outstandingAmount).sub(new Prisma.Decimal(r.ledgerBalance)),
  }));
}
