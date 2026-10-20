import { Prisma, WalletTransaction } from '@prisma/client';
import { BadRequestError } from '../../common/errors';

/**
 * The only code path that changes `Wallet.balance`.
 *
 * Each movement is a single atomic `UPDATE … RETURNING` (a debit also carries `balance >= amount` in its WHERE
 * clause), so concurrent movements serialize on the row lock and the balance cannot go negative. The ledger
 * entry is written in the same caller-supplied transaction, with `balanceAfter` taken from RETURNING.
 */

export interface WalletMovementOptions {
  remarks?: string;
  referenceId?: string;
  /** A repeated key returns the original entry instead of moving money again. */
  idempotencyKey?: string;
}

export interface WalletMovementResult {
  walletId: string;
  balance: Prisma.Decimal;
  transaction: WalletTransaction;
  replayed: boolean;
}

async function move(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: Prisma.Decimal,
  direction: 'CREDIT' | 'DEBIT',
  options: WalletMovementOptions,
): Promise<WalletMovementResult> {
  if (!amount.gt(0)) throw new BadRequestError('Amount must be greater than zero');

  // Lock the wallet row first so concurrent movements (including retries of the same idempotency key)
  // serialize; the replay check below then sees any entry committed by the request we just waited for.
  await tx.wallet.upsert({ where: { userId }, update: {}, create: { userId } });
  await tx.$queryRaw`SELECT "id" FROM "wallets" WHERE "userId" = ${userId} FOR UPDATE`;

  if (options.idempotencyKey) {
    const existing = await tx.walletTransaction.findUnique({
      where: { idempotencyKey: options.idempotencyKey },
      include: { wallet: true },
    });
    if (existing) {
      if (existing.wallet.userId !== userId) {
        throw new BadRequestError('Idempotency key was already used for a different wallet');
      }
      return { walletId: existing.walletId, balance: existing.wallet.balance, transaction: existing, replayed: true };
    }
  }

  const rows =
    direction === 'CREDIT'
      ? await tx.$queryRaw<Array<{ id: string; balance: Prisma.Decimal }>>`
          UPDATE "wallets" SET "balance" = "balance" + ${amount}, "updatedAt" = now()
          WHERE "userId" = ${userId}
          RETURNING "id", "balance"`
      : await tx.$queryRaw<Array<{ id: string; balance: Prisma.Decimal }>>`
          UPDATE "wallets" SET "balance" = "balance" - ${amount}, "updatedAt" = now()
          WHERE "userId" = ${userId} AND "balance" >= ${amount}
          RETURNING "id", "balance"`;

  if (rows.length === 0) throw new BadRequestError('Insufficient wallet balance');
  const balance = new Prisma.Decimal(rows[0].balance);

  const transaction = await tx.walletTransaction.create({
    data: {
      walletId: rows[0].id,
      type: direction,
      amount,
      balanceAfter: balance,
      remarks: options.remarks,
      referenceId: options.referenceId,
      idempotencyKey: options.idempotencyKey,
    },
  });
  return { walletId: rows[0].id, balance, transaction, replayed: false };
}

export function creditWallet(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: Prisma.Decimal,
  options: WalletMovementOptions = {},
): Promise<WalletMovementResult> {
  return move(tx, userId, amount, 'CREDIT', options);
}

export function debitWallet(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: Prisma.Decimal,
  options: WalletMovementOptions = {},
): Promise<WalletMovementResult> {
  return move(tx, userId, amount, 'DEBIT', options);
}
