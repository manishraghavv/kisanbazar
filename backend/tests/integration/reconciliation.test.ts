import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  api,
  bearer,
  createAdminAndLogin,
  createCatalogItem,
  createFarmerDirect,
  createKhataAccount,
  prisma,
  registerAndLogin,
} from '../helpers';
import { postKhataEntryTx } from '../../src/modules/khata/khata.ledger';
import { runKhataReconciliation } from '../../src/jobs/cron';

async function account() {
  const { vendor } = await createCatalogItem();
  const { farmer } = await createFarmerDirect();
  const acc = await createKhataAccount(vendor.id, farmer.id, 100_000);
  await postKhataEntryTx({
    accountId: acc.id,
    type: 'UDHAR_DIYA',
    amount: new Prisma.Decimal(500),
    performedById: 't',
  });
  return acc;
}

describe('khata reconciliation', () => {
  it('the admin endpoint reports drift, is admin-only, and the cron job alerts admins', async () => {
    const admin = await createAdminAndLogin();
    const acc = await account();

    const clean = await api().get('/api/admin/reconciliation/khata').set(bearer(admin));
    expect(clean.status).toBe(200);
    expect(clean.body.data.drift.some((d: { accountId: string }) => d.accountId === acc.id)).toBe(false);

    await prisma.khataAccount.update({ where: { id: acc.id }, data: { outstandingAmount: 530 } }); // bypasses the ledger
    const drifted = await api().get('/api/admin/reconciliation/khata').set(bearer(admin));
    const row = drifted.body.data.drift.find((d: { accountId: string }) => d.accountId === acc.id);
    expect(drifted.body.data.ok).toBe(false);
    expect(row.difference).toBe('30');

    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const before = await prisma.notification.count({ where: { userId: admin.id } });
    const { drift } = await runKhataReconciliation();
    expect(drift.some((d) => d.accountId === acc.id)).toBe(true);
    expect(errorLog.mock.calls.some((c) => String(c[0]).includes('[RECONCILE] DRIFT'))).toBe(true);
    expect(await prisma.notification.count({ where: { userId: admin.id } })).toBeGreaterThan(before);
    errorLog.mockRestore();

    // Repair the account so it does not pollute later runs.
    await prisma.khataAccount.update({ where: { id: acc.id }, data: { outstandingAmount: 500 } });
  });

  it('non-admins cannot read it', async () => {
    const farmer = await registerAndLogin('FARMER');
    expect((await api().get('/api/admin/reconciliation/khata').set(bearer(farmer))).status).toBe(403);
    expect((await api().get('/api/admin/reconciliation/khata')).status).toBe(401);
  });
});
