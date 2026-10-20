import PDFDocument from 'pdfkit';
import { Invoice, Prisma } from '@prisma/client';
import { prisma } from '../../common/lib/prisma';
import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors';
import { roundMoney, sum, taxLine, ZERO } from '../gst/gst';
import { stateName } from '../gst/states';

/**
 * Tax invoices and credit notes, one per vendor sub-order.
 *
 * Numbering is GAPLESS per (vendor, financial year, series): the next number is taken from `invoice_counters` with a
 * row-locking upsert INSIDE the transaction that creates the invoice, so a rolled-back invoice also rolls back its
 * number and concurrent invoices for one vendor serialize. Formats (GST rule 46 allows at most 16 characters):
 *     tax invoice  <PREFIX>/<FY4>/<6-digit seq>   e.g. V001/2627/000001
 *     credit note  <PREFIX>C/<FY4>/<5-digit seq>  e.g. V001C/2627/00001
 * The financial year runs 1 April - 31 March in India Standard Time.
 *
 * An invoice is issued when the sub-order is SHIPPED (the supply of goods happens on dispatch); a credit note is
 * issued when a return is resolved.
 */

type Tx = Prisma.TransactionClient;

export interface InvoiceLine {
  orderItemId: string;
  description: string;
  hsnCode: string | null;
  quantity: number;
  unitPrice: string;
  discount: string;
  taxableValue: string;
  gstRate: string;
  cgst: string;
  sgst: string;
  igst: string;
  total: string;
}

/** FY label ("2026-27") and compact form ("2627") for an instant, in IST. */
export function financialYearOf(instant: Date): { label: string; short: string } {
  const ist = new Date(instant.getTime() + 5.5 * 60 * 60 * 1000);
  const year = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? year : year - 1; // April (index 3) starts the year
  const end = (start + 1) % 100;
  const endStr = String(end).padStart(2, '0');
  return { label: `${start}-${endStr}`, short: `${String(start % 100).padStart(2, '0')}${endStr}` };
}

/** Allocates the next gapless number. Must run inside the transaction that inserts the invoice. */
async function nextInvoiceSeq(tx: Tx, vendorId: string, financialYear: string, series: 'INV' | 'CN'): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ lastSeq: number }>>`
    INSERT INTO "invoice_counters" ("vendorId", "financialYear", "series", "lastSeq")
    VALUES (${vendorId}, ${financialYear}, ${series}, 1)
    ON CONFLICT ("vendorId", "financialYear", "series")
    DO UPDATE SET "lastSeq" = "invoice_counters"."lastSeq" + 1
    RETURNING "lastSeq"`;
  return Number(rows[0].lastSeq);
}

/** Short per-vendor series prefix ("V001"), assigned once from a sequence. */
async function ensureInvoicePrefix(tx: Tx, vendor: { id: string; invoicePrefix: string | null }): Promise<string> {
  if (vendor.invoicePrefix) return vendor.invoicePrefix;
  // Lock the vendor row so two first invoices cannot both pick a prefix.
  await tx.$queryRaw`SELECT "id" FROM "vendors" WHERE "id" = ${vendor.id} FOR UPDATE`;
  const fresh = await tx.vendor.findUniqueOrThrow({ where: { id: vendor.id }, select: { invoicePrefix: true } });
  if (fresh.invoicePrefix) return fresh.invoicePrefix;
  const [{ n }] = await tx.$queryRaw<Array<{ n: bigint }>>`SELECT nextval('vendor_invoice_prefix_seq') AS n`;
  const prefix = `V${Number(n).toString(36).toUpperCase().padStart(3, '0')}`;
  await tx.vendor.update({ where: { id: vendor.id }, data: { invoicePrefix: prefix } });
  return prefix;
}

function addressText(a: {
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
}): string {
  return [a.addressLine1, a.addressLine2, a.city, `${a.state} - ${a.pincode}`].filter(Boolean).join(', ');
}

const str = (d: Prisma.Decimal) => d.toString();

// ── Tax invoice ──────────────────────────────────────────────────────────────

export async function issueTaxInvoice(tx: Tx, subOrderId: string): Promise<Invoice> {
  const existing = await tx.invoice.findUnique({ where: { uniqueKey: `INV:${subOrderId}` } });
  if (existing) return existing;

  const so = await tx.subOrder.findUniqueOrThrow({
    where: { id: subOrderId },
    include: {
      vendor: true,
      order: { include: { user: { select: { fullName: true } }, address: true } },
      items: { include: { variant: { select: { variantName: true, product: { select: { name: true } } } } } },
    },
  });
  const sellerState = so.sellerStateCode ?? so.vendor.stateCode;
  if (!sellerState) throw new ConflictError('The seller has not set a GST state, so an invoice cannot be issued');
  const placeOfSupply = so.placeOfSupply ?? so.order.address.stateCode ?? so.order.placeOfSupply;
  if (!placeOfSupply) throw new ConflictError('The delivery address has no state, so an invoice cannot be issued');
  const interState = so.sellerStateCode ? so.isInterState : sellerState !== placeOfSupply;

  // Pre-Phase-3 sub-orders have no tax split stored: recompute it from the line snapshot.
  const needsRecompute = so.cgstAmount.add(so.sgstAmount).add(so.igstAmount).isZero() && so.gstAmount.gt(0);
  const lines: InvoiceLine[] = [];
  let taxable = ZERO;
  let cgst = ZERO;
  let sgst = ZERO;
  let igst = ZERO;
  for (const item of so.items) {
    const t = needsRecompute
      ? taxLine(item.unitPrice, item.quantity, item.discountAmount, item.gstRate, interState)
      : {
          taxableValue: item.taxableValue,
          cgst: item.cgstAmount,
          sgst: item.sgstAmount,
          igst: item.igstAmount,
          lineGrandTotal: item.taxableValue.add(item.cgstAmount).add(item.sgstAmount).add(item.igstAmount),
        };
    taxable = taxable.add(t.taxableValue);
    cgst = cgst.add(t.cgst);
    sgst = sgst.add(t.sgst);
    igst = igst.add(t.igst);
    lines.push({
      orderItemId: item.id,
      description: `${item.variant.product.name}${item.variant.variantName ? ` (${item.variant.variantName})` : ''}`,
      hsnCode: item.hsnCode,
      quantity: item.quantity,
      unitPrice: str(item.unitPrice),
      discount: str(item.discountAmount),
      taxableValue: str(t.taxableValue),
      gstRate: str(item.gstRate),
      cgst: str(t.cgst),
      sgst: str(t.sgst),
      igst: str(t.igst),
      total: str(t.lineGrandTotal),
    });
  }

  const now = new Date();
  const fy = financialYearOf(now);
  const prefix = await ensureInvoicePrefix(tx, so.vendor);
  const seq = await nextInvoiceSeq(tx, so.vendorId, fy.label, 'INV');

  return tx.invoice.create({
    data: {
      invoiceNumber: `${prefix}/${fy.short}/${String(seq).padStart(6, '0')}`,
      type: 'TAX_INVOICE',
      uniqueKey: `INV:${subOrderId}`,
      vendorId: so.vendorId,
      subOrderId,
      financialYear: fy.label,
      seq,
      issuedAt: now,
      sellerName: so.vendor.businessName,
      sellerGstin: so.vendor.gstNumber,
      sellerStateCode: sellerState,
      sellerAddress: so.vendor.businessAddress,
      buyerName: so.order.user.fullName,
      buyerAddress: addressText(so.order.address),
      placeOfSupply,
      isInterState: interState,
      taxableValue: taxable,
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: igst,
      deliveryCharge: so.deliveryCharge,
      totalAmount: taxable.add(cgst).add(sgst).add(igst).add(so.deliveryCharge),
      lines: lines as unknown as Prisma.InputJsonValue,
    },
  });
}

// ── Credit note ──────────────────────────────────────────────────────────────

/**
 * Credit note for a return. Each returned line is credited pro rata to its invoiced amounts; when the last units of a
 * line come back, the line is credited the exact remainder so the notes add up to the invoice to the paisa.
 */
export async function issueCreditNote(tx: Tx, returnId: string): Promise<Invoice> {
  const existing = await tx.invoice.findUnique({ where: { uniqueKey: `CN:${returnId}` } });
  if (existing) return existing;

  const ret = await tx.returns.findUniqueOrThrow({
    where: { id: returnId },
    include: { items: { include: { orderItem: true } } },
  });
  if (!ret.subOrderId) throw new ConflictError('Return is not linked to a sub-order');
  const original = await issueTaxInvoice(tx, ret.subOrderId); // idempotent; also covers pre-Phase-3 deliveries

  const priorNotes = await tx.invoice.findMany({
    where: { subOrderId: ret.subOrderId, type: 'CREDIT_NOTE' },
    select: { lines: true },
  });
  const credited = new Map<
    string,
    { taxable: Prisma.Decimal; cgst: Prisma.Decimal; sgst: Prisma.Decimal; igst: Prisma.Decimal; qty: number }
  >();
  for (const note of priorNotes) {
    for (const l of note.lines as unknown as InvoiceLine[]) {
      const cur = credited.get(l.orderItemId) ?? { taxable: ZERO, cgst: ZERO, sgst: ZERO, igst: ZERO, qty: 0 };
      credited.set(l.orderItemId, {
        taxable: cur.taxable.add(l.taxableValue),
        cgst: cur.cgst.add(l.cgst),
        sgst: cur.sgst.add(l.sgst),
        igst: cur.igst.add(l.igst),
        qty: cur.qty + l.quantity,
      });
    }
  }

  const originalLines = original.lines as unknown as InvoiceLine[];
  const lines: InvoiceLine[] = [];
  for (const ri of ret.items) {
    const src = originalLines.find((l) => l.orderItemId === ri.orderItemId);
    if (!src) throw new ConflictError('Returned item is not on the invoice');
    const prior = credited.get(ri.orderItemId) ?? { taxable: ZERO, cgst: ZERO, sgst: ZERO, igst: ZERO, qty: 0 };
    const finalUnits = prior.qty + ri.quantity === src.quantity;
    const part = (total: string, soFar: Prisma.Decimal) =>
      finalUnits
        ? new Prisma.Decimal(total).sub(soFar)
        : roundMoney(new Prisma.Decimal(total).mul(ri.quantity).div(src.quantity));
    const taxableValue = part(src.taxableValue, prior.taxable);
    const cgst = part(src.cgst, prior.cgst);
    const sgst = part(src.sgst, prior.sgst);
    const igst = part(src.igst, prior.igst);
    lines.push({
      ...src,
      quantity: ri.quantity,
      discount: str(roundMoney(new Prisma.Decimal(src.discount).mul(ri.quantity).div(src.quantity))),
      taxableValue: str(taxableValue),
      cgst: str(cgst),
      sgst: str(sgst),
      igst: str(igst),
      total: str(taxableValue.add(cgst).add(sgst).add(igst)),
    });
  }

  const taxable = sum(lines.map((l) => new Prisma.Decimal(l.taxableValue)));
  const cgst = sum(lines.map((l) => new Prisma.Decimal(l.cgst)));
  const sgst = sum(lines.map((l) => new Prisma.Decimal(l.sgst)));
  const igst = sum(lines.map((l) => new Prisma.Decimal(l.igst)));

  const now = new Date();
  const fy = financialYearOf(now);
  const prefix = await ensureInvoicePrefix(tx, await tx.vendor.findUniqueOrThrow({ where: { id: original.vendorId } }));
  const seq = await nextInvoiceSeq(tx, original.vendorId, fy.label, 'CN');

  return tx.invoice.create({
    data: {
      invoiceNumber: `${prefix}C/${fy.short}/${String(seq).padStart(5, '0')}`,
      type: 'CREDIT_NOTE',
      uniqueKey: `CN:${returnId}`,
      vendorId: original.vendorId,
      subOrderId: ret.subOrderId,
      financialYear: fy.label,
      seq,
      issuedAt: now,
      originalInvoiceId: original.id,
      returnId,
      sellerName: original.sellerName,
      sellerGstin: original.sellerGstin,
      sellerStateCode: original.sellerStateCode,
      sellerAddress: original.sellerAddress,
      buyerName: original.buyerName,
      buyerAddress: original.buyerAddress,
      placeOfSupply: original.placeOfSupply,
      isInterState: original.isInterState,
      taxableValue: taxable,
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: igst,
      deliveryCharge: ZERO,
      totalAmount: taxable.add(cgst).add(sgst).add(igst),
      lines: lines as unknown as Prisma.InputJsonValue,
    },
  });
}

// ── Reading + PDF ────────────────────────────────────────────────────────────

/** Who may see a sub-order's documents: its customer, its vendor, or an admin. */
export async function assertCanSeeSubOrder(subOrderId: string, user: { id: string; role: string }) {
  const so = await prisma.subOrder.findUnique({
    where: { id: subOrderId },
    include: { order: { select: { userId: true } }, vendor: { select: { userId: true } } },
  });
  if (!so) throw new NotFoundError('Sub-order not found');
  if (user.role === 'ADMIN') return so;
  if (so.order.userId === user.id) return so;
  if (user.role === 'VENDOR' && so.vendor.userId === user.id) return so;
  throw new ForbiddenError('Access denied');
}

export const InvoiceService = {
  /** Invoices (tax invoice + credit notes) of one sub-order. Issues the tax invoice lazily if it was missed. */
  async listForSubOrder(subOrderId: string, user: { id: string; role: string }) {
    const so = await assertCanSeeSubOrder(subOrderId, user);
    const shippedOrLater = ['SHIPPED', 'DELIVERED', 'RETURNED', 'REFUNDED'].includes(so.status);
    if (shippedOrLater) {
      await prisma.$transaction((tx) => issueTaxInvoice(tx, subOrderId));
    }
    return prisma.invoice.findMany({ where: { subOrderId }, orderBy: { issuedAt: 'asc' } });
  },

  async getForUser(invoiceId: string, user: { id: string; role: string }) {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundError('Invoice not found');
    await assertCanSeeSubOrder(invoice.subOrderId, user);
    return invoice;
  },

  /** All invoices of an order that the caller may see (vendors only see their own). */
  async listForOrder(orderId: string, user: { id: string; role: string }) {
    const subs = await prisma.subOrder.findMany({ where: { orderId }, select: { id: true } });
    const out: Invoice[] = [];
    for (const s of subs) {
      try {
        out.push(...(await InvoiceService.listForSubOrder(s.id, user)));
      } catch (err) {
        if (!(err instanceof ForbiddenError)) throw err;
      }
    }
    return out;
  },

  renderPdf(invoice: Invoice): PDFKit.PDFDocument {
    const lines = invoice.lines as unknown as InvoiceLine[];
    const isCredit = invoice.type === 'CREDIT_NOTE';
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const money = (v: string | Prisma.Decimal) => `Rs ${new Prisma.Decimal(v).toFixed(2)}`;

    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(isCredit ? 'CREDIT NOTE' : 'TAX INVOICE', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').fillColor('#444');
    doc.text(`${isCredit ? 'Credit note' : 'Invoice'} no.: ${invoice.invoiceNumber}`, { align: 'center' });
    doc.text(
      `Date: ${invoice.issuedAt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}   Financial year: ${invoice.financialYear}`,
      {
        align: 'center',
      },
    );
    doc.moveDown(0.8);

    const top = doc.y;
    doc.fillColor('#000').fontSize(10).font('Helvetica-Bold').text('Seller', 40, top);
    doc.font('Helvetica').fontSize(9).fillColor('#333');
    doc.text(invoice.sellerName, 40, doc.y, { width: 240 });
    if (invoice.sellerGstin) doc.text(`GSTIN: ${invoice.sellerGstin}`, 40, doc.y, { width: 240 });
    if (invoice.sellerAddress) doc.text(invoice.sellerAddress, 40, doc.y, { width: 240 });
    doc.text(
      `State: ${stateName(invoice.sellerStateCode) ?? invoice.sellerStateCode} (${invoice.sellerStateCode})`,
      40,
      doc.y,
      {
        width: 240,
      },
    );
    const sellerBottom = doc.y;

    doc.fillColor('#000').fontSize(10).font('Helvetica-Bold').text('Buyer / Ship to', 320, top);
    doc.font('Helvetica').fontSize(9).fillColor('#333');
    doc.text(invoice.buyerName, 320, doc.y, { width: 235 });
    doc.text(invoice.buyerAddress, 320, doc.y, { width: 235 });
    doc.text(
      `Place of supply: ${stateName(invoice.placeOfSupply) ?? invoice.placeOfSupply} (${invoice.placeOfSupply})`,
      320,
      doc.y,
      {
        width: 235,
      },
    );
    doc.text(invoice.isInterState ? 'Inter-state supply (IGST)' : 'Intra-state supply (CGST + SGST)', 320, doc.y, {
      width: 235,
    });
    doc.y = Math.max(sellerBottom, doc.y) + 12;

    // Line table
    const cols = [
      { h: 'HSN', w: 38, a: 'left' as const, v: (l: InvoiceLine) => l.hsnCode ?? '-' },
      { h: 'Description', w: 128, a: 'left' as const, v: (l: InvoiceLine) => l.description },
      { h: 'Qty', w: 24, a: 'right' as const, v: (l: InvoiceLine) => String(l.quantity) },
      { h: 'Rate', w: 46, a: 'right' as const, v: (l: InvoiceLine) => new Prisma.Decimal(l.unitPrice).toFixed(2) },
      { h: 'Disc.', w: 40, a: 'right' as const, v: (l: InvoiceLine) => new Prisma.Decimal(l.discount).toFixed(2) },
      {
        h: 'Taxable',
        w: 52,
        a: 'right' as const,
        v: (l: InvoiceLine) => new Prisma.Decimal(l.taxableValue).toFixed(2),
      },
      { h: 'GST%', w: 28, a: 'right' as const, v: (l: InvoiceLine) => new Prisma.Decimal(l.gstRate).toString() },
      { h: 'CGST', w: 40, a: 'right' as const, v: (l: InvoiceLine) => new Prisma.Decimal(l.cgst).toFixed(2) },
      { h: 'SGST', w: 40, a: 'right' as const, v: (l: InvoiceLine) => new Prisma.Decimal(l.sgst).toFixed(2) },
      { h: 'IGST', w: 40, a: 'right' as const, v: (l: InvoiceLine) => new Prisma.Decimal(l.igst).toFixed(2) },
      { h: 'Total', w: 52, a: 'right' as const, v: (l: InvoiceLine) => new Prisma.Decimal(l.total).toFixed(2) },
    ];
    let y = doc.y;
    doc.rect(40, y - 3, 515, 16).fill('#2D6A4F');
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7.5);
    let x = 40;
    for (const c of cols) {
      doc.text(c.h, x + 2, y, { width: c.w - 4, align: c.a });
      x += c.w;
    }
    y += 16;
    doc.font('Helvetica').fillColor('#222').fontSize(7.5);
    lines.forEach((l, i) => {
      if (i % 2 === 0) doc.rect(40, y - 2, 515, 14).fill('#F5F5F5');
      doc.fillColor('#222');
      x = 40;
      for (const c of cols) {
        doc.text(c.v(l), x + 2, y, { width: c.w - 4, align: c.a, lineBreak: false });
        x += c.w;
      }
      y += 14;
    });
    doc.y = y + 10;

    // Totals
    const rows: Array<[string, string]> = [['Taxable value', money(invoice.taxableValue)]];
    if (!new Prisma.Decimal(invoice.cgstAmount).isZero() || !invoice.isInterState)
      rows.push(['CGST', money(invoice.cgstAmount)]);
    if (!new Prisma.Decimal(invoice.sgstAmount).isZero() || !invoice.isInterState)
      rows.push(['SGST', money(invoice.sgstAmount)]);
    if (!new Prisma.Decimal(invoice.igstAmount).isZero() || invoice.isInterState)
      rows.push(['IGST', money(invoice.igstAmount)]);
    if (!new Prisma.Decimal(invoice.deliveryCharge).isZero())
      rows.push(['Delivery charge', money(invoice.deliveryCharge)]);
    doc.fontSize(9).font('Helvetica').fillColor('#333');
    for (const [label, value] of rows) {
      const ry = doc.y;
      doc.text(label, 355, ry, { width: 110, align: 'right' });
      doc.text(value, 470, ry, { width: 85, align: 'right' });
      doc.y = ry + 14;
    }
    doc.moveTo(355, doc.y).lineTo(555, doc.y).strokeColor('#ccc').stroke();
    doc.moveDown(0.3);
    const ty = doc.y;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000');
    doc.text(isCredit ? 'Credit total' : 'Invoice total', 355, ty, { width: 110, align: 'right' });
    doc.text(money(invoice.totalAmount), 470, ty, { width: 85, align: 'right' });

    doc.moveDown(2).fontSize(8).font('Helvetica').fillColor('#666');
    if (isCredit) doc.text('This credit note adjusts the tax invoice of the same sub-order for returned goods.', 40);
    doc.text('Prices are exclusive of GST; GST is shown per line. This is a computer-generated document.', 40);
    doc.end();
    return doc;
  },
};
