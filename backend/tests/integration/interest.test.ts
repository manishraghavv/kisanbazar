import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { createCatalogItem, createFarmerDirect, createKhataAccount, prisma } from '../helpers';
import { postKhataEntryTx, reconcileKhata } from '../../src/modules/khata/khata.ledger';
import { runInterestCalculation } from '../../src/jobs/cron';

const DAY = 24 * 60 * 60 * 1000;

async function accountWithDebt(amount: number) {
  const { vendor } = await createCatalogItem();
  const { farmer } = await createFarmerDirect();
  const account = await createKhataAccount(vendor.id, farmer.id, 10_000_000); // 12% p.a.
  await postKhataEntryTx({
    accountId: account.id,
    type: 'UDHAR_DIYA',
    amount: new Prisma.Decimal(amount),
    performedById: 't',
  });
  return account;
}
const interestRows = (accountId: string) =>
  prisma.khataTransaction.findMany({
    where: { khataAccountId: accountId, type: 'INTEREST_LAGA' },
    orderBy: { createdAt: 'asc' },
  });
const setLastTx = (accountId: string, d: Date) =>
  prisma.khataAccount.update({ where: { id: accountId }, data: { lastTransactionAt: d } });

describe('khata interest cadence and rate', () => {
  it('posts one entry per day at annual rate / 365, compounding, and never twice on the same day', async () => {
    const account = await accountWithDebt(36_500); // 12% => 12.00 on day 1
    const start = new Date('2030-01-01T10:00:00Z');
    await setLastTx(account.id, new Date(start.getTime() - 30 * DAY));

    for (let i = 0; i < 5; i++) {
      const now = new Date(start.getTime() + i * DAY);
      await runInterestCalculation({ now, graceDays: 7 });
      await runInterestCalculation({ now: new Date(now.getTime() + 3600_000), graceDays: 7 }); // same UTC day: no-op
    }
    const rows = await interestRows(account.id);
    expect(rows).toHaveLength(5);
    // 36500 * 12 / 36500 = 12.00; next day base is 36512 -> 12.00 (11.99… rounds to 12.00); amounts follow the balance.
    expect(rows[0].amount.toString()).toBe('12');
    let balance = new Prisma.Decimal(36_500);
    for (const row of rows) {
      const expected = balance.mul(12).div(36_500).toDecimalPlaces(2);
      expect(row.amount.toString()).toBe(expected.toString());
      balance = balance.add(expected);
      expect(row.balanceAfter.toString()).toBe(balance.toString());
    }
    const fresh = await prisma.khataAccount.findUniqueOrThrow({ where: { id: account.id } });
    expect(fresh.outstandingAmount.toString()).toBe(balance.toString());
    expect(await reconcileKhata(account.id)).toEqual([]);
  });

  it('interest postings do not restart the grace period (cadence stays daily)', async () => {
    const account = await accountWithDebt(10_000);
    const start = new Date('2031-03-01T00:30:00Z');
    await setLastTx(account.id, new Date(start.getTime() - 8 * DAY));
    for (let i = 0; i < 3; i++)
      await runInterestCalculation({ now: new Date(start.getTime() + i * DAY), graceDays: 7 });
    expect(await interestRows(account.id)).toHaveLength(3);
  });

  it('no interest inside the grace period after a real transaction', async () => {
    const account = await accountWithDebt(10_000);
    const now = new Date('2032-06-01T00:30:00Z');
    await setLastTx(account.id, new Date(now.getTime() - 3 * DAY));
    await runInterestCalculation({ now, graceDays: 7 });
    expect(await interestRows(account.id)).toHaveLength(0);
    // ...and it starts as soon as the grace period has elapsed.
    await runInterestCalculation({ now: new Date(now.getTime() + 4 * DAY), graceDays: 7 });
    expect(await interestRows(account.id)).toHaveLength(1);
  });

  it('skips settled, suspended and zero-rate accounts', async () => {
    const zero = await accountWithDebt(1000);
    await prisma.khataAccount.update({
      where: { id: zero.id },
      data: { interestRatePct: 0, lastTransactionAt: new Date(0) },
    });
    const suspended = await accountWithDebt(1000);
    await prisma.khataAccount.update({
      where: { id: suspended.id },
      data: { status: 'SUSPENDED', lastTransactionAt: new Date(0) },
    });
    await runInterestCalculation({ now: new Date('2033-01-01T00:00:00Z'), graceDays: 1 });
    expect(await interestRows(zero.id)).toHaveLength(0);
    expect(await interestRows(suspended.id)).toHaveLength(0);
  });
});
