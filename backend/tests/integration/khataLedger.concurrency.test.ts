import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { createCatalogItem, createFarmerDirect, createKhataAccount, prisma } from '../helpers';
import { postKhataEntryTx, reconcileKhata } from '../../src/modules/khata/khata.ledger';
import { runInterestCalculation } from '../../src/jobs/cron';

const D = (v: number | string) => new Prisma.Decimal(v);

async function newAccount(limit: number) {
  const { vendor } = await createCatalogItem();
  const { farmer } = await createFarmerDirect();
  return createKhataAccount(vendor.id, farmer.id, limit);
}

const debit = (accountId: string, amount: number, extra: Record<string, unknown> = {}) =>
  postKhataEntryTx({ accountId, type: 'UDHAR_DIYA', amount: D(amount), performedById: 'test', ...extra });

describe('khata ledger under concurrency', () => {
  it('100 parallel debits produce the exact balance and a consistent ledger', async () => {
    const account = await newAccount(1_000_000);
    const results = await Promise.allSettled(Array.from({ length: 100 }, () => debit(account.id, 10)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(100);

    const fresh = await prisma.khataAccount.findUniqueOrThrow({ where: { id: account.id } });
    expect(fresh.outstandingAmount.toString()).toBe('1000');

    const entries = await prisma.khataTransaction.findMany({ where: { khataAccountId: account.id } });
    expect(entries).toHaveLength(100);
    // Every balanceAfter is distinct and the set is exactly 10, 20, … 1000: no two writers saw the same balance.
    const balances = entries.map((e) => Number(e.balanceAfter)).sort((a, b) => a - b);
    expect(balances).toEqual(Array.from({ length: 100 }, (_, i) => (i + 1) * 10));

    expect(await reconcileKhata(account.id)).toEqual([]);
  });

  it('the credit limit is never exceeded by parallel debits', async () => {
    const account = await newAccount(500);
    const results = await Promise.allSettled(Array.from({ length: 100 }, () => debit(account.id, 10)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(50);
    const fresh = await prisma.khataAccount.findUniqueOrThrow({ where: { id: account.id } });
    expect(fresh.outstandingAmount.toString()).toBe('500');
    expect(await reconcileKhata(account.id)).toEqual([]);
  });

  it('parallel debits and repayments net out exactly', async () => {
    const account = await newAccount(1_000_000);
    await debit(account.id, 1000);
    const ops = [
      ...Array.from({ length: 40 }, () => debit(account.id, 5)),
      ...Array.from({ length: 40 }, () =>
        postKhataEntryTx({ accountId: account.id, type: 'WAPSI_MILI', amount: D(3), performedById: 'test' }),
      ),
    ];
    const results = await Promise.allSettled(ops);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const fresh = await prisma.khataAccount.findUniqueOrThrow({ where: { id: account.id } });
    expect(fresh.outstandingAmount.toString()).toBe(String(1000 + 40 * 5 - 40 * 3));
    expect(await reconcileKhata(account.id)).toEqual([]);
  });

  it('an idempotency key posts once no matter how many times (or how concurrently) it is sent', async () => {
    const account = await newAccount(1_000_000);
    const results = await Promise.all(
      Array.from({ length: 10 }, () => debit(account.id, 100, { idempotencyKey: `k-${account.id}` })),
    );
    expect(results.filter((r) => !r.replayed)).toHaveLength(1);
    const fresh = await prisma.khataAccount.findUniqueOrThrow({ where: { id: account.id } });
    expect(fresh.outstandingAmount.toString()).toBe('100');
    expect(await prisma.khataTransaction.count({ where: { khataAccountId: account.id } })).toBe(1);
  });

  it('a repayment larger than the balance is rejected (the balance cannot go negative)', async () => {
    const account = await newAccount(1000);
    await debit(account.id, 100);
    await expect(
      postKhataEntryTx({ accountId: account.id, type: 'WAPSI_MILI', amount: D(150), performedById: 'test' }),
    ).rejects.toThrow(/exceeds the outstanding/);
    const fresh = await prisma.khataAccount.findUniqueOrThrow({ where: { id: account.id } });
    expect(fresh.outstandingAmount.toString()).toBe('100');
  });

  it('a debit never overwrites OVERDUE with ACTIVE, and a full repayment settles', async () => {
    const account = await newAccount(10_000);
    await debit(account.id, 100);
    await prisma.khataAccount.update({ where: { id: account.id }, data: { status: 'OVERDUE' } });

    await debit(account.id, 50);
    expect((await prisma.khataAccount.findUniqueOrThrow({ where: { id: account.id } })).status).toBe('OVERDUE');

    await postKhataEntryTx({ accountId: account.id, type: 'WAPSI_MILI', amount: D(150), performedById: 'test' });
    expect((await prisma.khataAccount.findUniqueOrThrow({ where: { id: account.id } })).status).toBe('SETTLED');

    await debit(account.id, 10);
    expect((await prisma.khataAccount.findUniqueOrThrow({ where: { id: account.id } })).status).toBe('ACTIVE');
  });

  it('SUSPENDED accounts reject postings', async () => {
    const account = await newAccount(10_000);
    await prisma.khataAccount.update({ where: { id: account.id }, data: { status: 'SUSPENDED' } });
    await expect(debit(account.id, 10)).rejects.toThrow(/suspended/);
  });

  it('the interest cron posts at most once per account per day', async () => {
    const account = await newAccount(1_000_000);
    await debit(account.id, 36_500); // 12% p.a. => 12.00 per day
    const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const age = () => prisma.khataAccount.update({ where: { id: account.id }, data: { lastTransactionAt: longAgo } });

    await age();
    await runInterestCalculation();
    await age(); // defeat the grace-period guard so only the idempotency key can stop a second posting
    await runInterestCalculation();

    const interest = await prisma.khataTransaction.findMany({
      where: { khataAccountId: account.id, type: 'INTEREST_LAGA' },
    });
    expect(interest).toHaveLength(1);
    expect(interest[0].amount.toString()).toBe('12');
    const fresh = await prisma.khataAccount.findUniqueOrThrow({ where: { id: account.id } });
    expect(fresh.outstandingAmount.toString()).toBe('36512');
    expect(await reconcileKhata(account.id)).toEqual([]);
  });

  it('reconciliation reports accounts whose balance disagrees with the ledger', async () => {
    const account = await newAccount(10_000);
    await debit(account.id, 100);
    expect(await reconcileKhata(account.id)).toEqual([]);

    await prisma.khataAccount.update({ where: { id: account.id }, data: { outstandingAmount: D(105) } });
    const [row] = await reconcileKhata(account.id);
    expect(row.accountId).toBe(account.id);
    expect(row.difference.toString()).toBe('5');
    expect((await reconcileKhata()).some((r) => r.accountId === account.id)).toBe(true);
  });

  it('the database refuses a negative outstanding balance', async () => {
    const account = await newAccount(10_000);
    await expect(
      prisma.khataAccount.update({ where: { id: account.id }, data: { outstandingAmount: D(-1) } }),
    ).rejects.toThrow();
  });
});
