import { describe, expect, it } from 'vitest';
import { OrderService } from '../../src/modules/orders/order.service';
import { SubOrderService } from '../../src/modules/orders/subOrder.service';
import { financialYearOf, issueTaxInvoice } from '../../src/modules/orders/invoice.service';
import { api, bearer, createCatalogItem, createFarmerDirect, fillCart, prisma, tokenFor } from '../helpers';

type Catalog = Awaited<ReturnType<typeof createCatalogItem>>;

/** An order for `vendor`'s item that has been moved to PACKED, ready to ship. */
async function packedSubOrder(vendor: Catalog, opts: { buyerState?: string } = {}) {
  const f = await createFarmerDirect({ stateCode: opts.buyerState });
  await fillCart(f.user.id, [{ variantId: vendor.variant.id, quantity: 1 }]);
  const order = await OrderService.create(f.user.id, { addressId: f.address.id, paymentMethod: 'COD' });
  const so = await prisma.subOrder.findFirstOrThrow({ where: { orderId: order.id, vendorId: vendor.vendor.id } });
  const actor = { id: vendor.vendorUser.id, role: 'VENDOR' };
  for (const status of ['CONFIRMED', 'PROCESSING', 'PACKED'])
    await SubOrderService.updateStatus(actor, so.id, { status });
  return { f, order, so, actor };
}

const ship = (actor: { id: string; role: string }, subOrderId: string) =>
  SubOrderService.updateStatus(actor, subOrderId, { status: 'SHIPPED' });

describe('financial year', () => {
  it('runs 1 April - 31 March in IST', () => {
    expect(financialYearOf(new Date('2026-03-31T10:00:00Z'))).toEqual({ label: '2025-26', short: '2526' });
    expect(financialYearOf(new Date('2026-04-01T10:00:00Z'))).toEqual({ label: '2026-27', short: '2627' });
    // 31 March 20:00 UTC is already 1 April 01:30 in India
    expect(financialYearOf(new Date('2026-03-31T20:00:00Z'))).toEqual({ label: '2026-27', short: '2627' });
    expect(financialYearOf(new Date('2027-01-15T00:00:00Z')).label).toBe('2026-27');
    expect(financialYearOf(new Date('2099-12-31T00:00:00Z')).short).toBe('9900');
  });
});

describe('tax invoices', () => {
  it('is issued when the sub-order ships and carries seller/buyer, place of supply and the tax split', async () => {
    const v = await createCatalogItem({ stock: 10, price: 100, gstRate: 18, vendorState: '27', hsnCode: '3808' });
    await prisma.vendor.update({
      where: { id: v.vendor.id },
      data: {
        gstNumber: `27AAPFU${Math.floor(1000 + Math.random() * 9000)}F1ZV`,
        businessAddress: '9 MIDC, Pune',
        businessName: 'Shree Agro',
      },
    });
    const t = await packedSubOrder(v, { buyerState: '09' }); // Maharashtra -> UP: inter-state
    expect(await prisma.invoice.count({ where: { subOrderId: t.so.id } })).toBe(0);

    await ship(t.actor, t.so.id);
    const invoice = await prisma.invoice.findFirstOrThrow({ where: { subOrderId: t.so.id } });
    expect(invoice.type).toBe('TAX_INVOICE');
    expect(invoice.sellerName).toBe('Shree Agro');
    expect(invoice.sellerGstin).toMatch(/^27AAPFU/);
    expect(invoice.sellerStateCode).toBe('27');
    expect(invoice.placeOfSupply).toBe('09');
    expect(invoice.isInterState).toBe(true);
    expect([invoice.cgstAmount.toString(), invoice.sgstAmount.toString(), invoice.igstAmount.toString()]).toEqual([
      '0',
      '0',
      '18',
    ]);
    expect(invoice.taxableValue.toString()).toBe('100');
    expect(invoice.totalAmount.toString()).toBe('158'); // 100 + 18 IGST + 40 delivery
    const lines = invoice.lines as Array<{ hsnCode: string; igst: string }>;
    expect(lines[0].hsnCode).toBe('3808');
    expect(lines[0].igst).toBe('18');
    expect(invoice.invoiceNumber).toMatch(/^V[0-9A-Z]{3}\/\d{4}\/\d{6}$/);
    expect(invoice.invoiceNumber.length).toBeLessThanOrEqual(16);
    expect(invoice.financialYear).toMatch(/^\d{4}-\d{2}$/);
  });

  it('an intra-state sale shows CGST + SGST', async () => {
    const v = await createCatalogItem({ stock: 10, price: 100, gstRate: 12, vendorState: '09' });
    const t = await packedSubOrder(v, { buyerState: '09' });
    await ship(t.actor, t.so.id);
    const invoice = await prisma.invoice.findFirstOrThrow({ where: { subOrderId: t.so.id } });
    expect(invoice.isInterState).toBe(false);
    expect([invoice.cgstAmount.toString(), invoice.sgstAmount.toString(), invoice.igstAmount.toString()]).toEqual([
      '6',
      '6',
      '0',
    ]);
  });

  it('numbers are sequential and gapless per vendor, and each vendor has its own series', async () => {
    const v1 = await createCatalogItem({ stock: 50, price: 100 });
    const v2 = await createCatalogItem({ stock: 50, price: 100 });
    const numbers1: number[] = [];
    for (let i = 0; i < 3; i++) {
      const t = await packedSubOrder(v1);
      await ship(t.actor, t.so.id);
      numbers1.push((await prisma.invoice.findFirstOrThrow({ where: { subOrderId: t.so.id } })).seq);
    }
    expect(numbers1).toEqual([1, 2, 3]);
    const t2 = await packedSubOrder(v2);
    await ship(t2.actor, t2.so.id);
    const first2 = await prisma.invoice.findFirstOrThrow({ where: { subOrderId: t2.so.id } });
    expect(first2.seq).toBe(1);
    const p1 = (await prisma.vendor.findUniqueOrThrow({ where: { id: v1.vendor.id } })).invoicePrefix;
    const p2 = (await prisma.vendor.findUniqueOrThrow({ where: { id: v2.vendor.id } })).invoicePrefix;
    expect(p1).not.toBe(p2);
    expect(first2.invoiceNumber.startsWith(`${p2}/`)).toBe(true);
  });

  it('10 sub-orders of one vendor shipped in parallel get numbers 1..10 with no duplicates and no gaps', async () => {
    const v = await createCatalogItem({ stock: 100, price: 100 });
    const subs = await Promise.all(Array.from({ length: 10 }, () => packedSubOrder(v)));
    const results = await Promise.allSettled(subs.map((t) => ship(t.actor, t.so.id)));
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const invoices = await prisma.invoice.findMany({ where: { vendorId: v.vendor.id, type: 'TAX_INVOICE' } });
    expect(invoices.map((i) => i.seq).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(new Set(invoices.map((i) => i.invoiceNumber)).size).toBe(10);
    const counter = await prisma.invoiceCounter.findFirstOrThrow({ where: { vendorId: v.vendor.id, series: 'INV' } });
    expect(counter.lastSeq).toBe(10);
  });

  it('issuing twice is idempotent, and a rolled-back invoice gives its number back (no gap)', async () => {
    const v = await createCatalogItem({ stock: 20, price: 100 });
    const t1 = await packedSubOrder(v);
    await ship(t1.actor, t1.so.id);
    const again = await prisma.$transaction((tx) => issueTaxInvoice(tx, t1.so.id));
    expect(again.seq).toBe(1);
    expect(await prisma.invoice.count({ where: { subOrderId: t1.so.id } })).toBe(1);

    // an invoice that is created and then rolled back must not consume a number
    const t2 = await packedSubOrder(v);
    await expect(
      prisma.$transaction(async (tx) => {
        await issueTaxInvoice(tx, t2.so.id);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await prisma.invoice.count({ where: { subOrderId: t2.so.id } })).toBe(0);
    await ship(t2.actor, t2.so.id);
    expect((await prisma.invoice.findFirstOrThrow({ where: { subOrderId: t2.so.id } })).seq).toBe(2);
  });

  it('refuses to issue when the seller has no GST state', async () => {
    const v = await createCatalogItem({ stock: 5, price: 100 });
    const t = await packedSubOrder(v);
    await prisma.vendor.update({ where: { id: v.vendor.id }, data: { stateCode: null } });
    await prisma.subOrder.update({ where: { id: t.so.id }, data: { sellerStateCode: null } });
    await expect(ship(t.actor, t.so.id)).rejects.toThrow(/GST state/);
    expect((await prisma.subOrder.findUniqueOrThrow({ where: { id: t.so.id } })).status).toBe('PACKED'); // rolled back
  });
});

describe('invoice access and PDF', () => {
  it('customer and owning seller can download the PDF; other customers and sellers cannot', async () => {
    const v = await createCatalogItem({ stock: 10, price: 100 });
    const other = await createCatalogItem({ stock: 10, price: 100 });
    const t = await packedSubOrder(v);
    await ship(t.actor, t.so.id);

    const customer = bearer(tokenFor(t.f.user.id));
    const pdf = await api()
      .get(`/api/sub-orders/${t.so.id}/invoice`)
      .set(customer)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');

    expect((await api().get(`/api/sub-orders/${t.so.id}/invoice`).set(bearer(v.vendorUser))).status).toBe(200);
    expect((await api().get(`/api/sub-orders/${t.so.id}/invoice`).set(bearer(other.vendorUser))).status).toBe(403);
    const stranger = await createFarmerDirect();
    expect(
      (
        await api()
          .get(`/api/sub-orders/${t.so.id}/invoice`)
          .set(bearer(tokenFor(stranger.user.id)))
      ).status,
    ).toBe(403);
    expect((await api().get(`/api/sub-orders/${t.so.id}/invoice`)).status).toBe(401);

    const invoice = await prisma.invoice.findFirstOrThrow({ where: { subOrderId: t.so.id } });
    expect((await api().get(`/api/invoices/${invoice.id}`).set(customer)).status).toBe(200);
    expect((await api().get(`/api/invoices/${invoice.id}/pdf`).set(bearer(other.vendorUser))).status).toBe(403);
  });

  it('the legacy order invoice route serves a single invoice and asks for a sub-order when there are several', async () => {
    const a = await createCatalogItem({ stock: 10, price: 100 });
    const b = await createCatalogItem({ stock: 10, price: 100 });
    const f = await createFarmerDirect();
    await fillCart(f.user.id, [
      { variantId: a.variant.id, quantity: 1 },
      { variantId: b.variant.id, quantity: 1 },
    ]);
    const order = await OrderService.create(f.user.id, { addressId: f.address.id, paymentMethod: 'COD' });
    for (const v of [a, b]) {
      const so = await prisma.subOrder.findFirstOrThrow({ where: { orderId: order.id, vendorId: v.vendor.id } });
      const actor = { id: v.vendorUser.id, role: 'VENDOR' };
      for (const status of ['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED'])
        await SubOrderService.updateStatus(actor, so.id, { status });
    }
    const customer = bearer(tokenFor(f.user.id));
    const multi = await api().get(`/api/orders/${order.id}/invoice`).set(customer);
    expect(multi.status).toBe(409);
    expect(multi.body.data).toHaveLength(2);
    const data = await api().get(`/api/orders/${order.id}/invoice-data`).set(customer);
    expect(data.body.data).toHaveLength(2);
    // a vendor sees only their own invoice in the order-level listing
    const asA = await api().get(`/api/orders/${order.id}/invoice-data`).set(bearer(a.vendorUser));
    expect(asA.body.data).toHaveLength(1);
    expect((await api().get(`/api/orders/${order.id}/invoice`).set(bearer(a.vendorUser))).status).toBe(200);
  });
});
