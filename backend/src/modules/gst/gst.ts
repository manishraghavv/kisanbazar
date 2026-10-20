import { Prisma } from '@prisma/client';

/**
 * GST engine: pure functions, no I/O.
 *
 * Rules (documented here because they are the contract the tests pin down):
 *  - Prices are GST-EXCLUSIVE. Tax is charged on top of the taxable value.
 *  - Taxable value of a line = line total (unit price x quantity) - the coupon discount allocated to that line.
 *    A discount reduces the taxable value, so tax is never charged on money the buyer did not pay.
 *  - Intra-state supply (seller state == buyer's place of supply): CGST and SGST, each at half the rate.
 *    Inter-state supply: IGST at the full rate.
 *  - ROUNDING happens PER LINE, to 2 decimal places, half-up (away from zero on .5):
 *        CGST = SGST = round(taxable x rate / 2 / 100)        IGST = round(taxable x rate / 100)
 *    CGST and SGST are rounded independently from the half rate, so they are always equal and the line's total
 *    tax can differ by a paisa from round(taxable x rate / 100) (e.g. taxable 0.10 at 5%: CGST 0.00 + SGST 0.00 vs IGST 0.01).
 *    Sub-order and order tax totals are plain sums of the rounded line amounts (no re-rounding).
 *  - Discount allocation across lines is proportional to line totals using the largest-remainder method in whole
 *    paise, so the allocated parts always add up to the discount exactly.
 *  - The delivery charge carries no GST in this system (documented assumption).
 */

export const ZERO = new Prisma.Decimal(0);

export function roundMoney(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/** Intra-state if the seller's state code equals the buyer's place of supply. */
export function isInterState(sellerStateCode: string, placeOfSupplyStateCode: string): boolean {
  return sellerStateCode !== placeOfSupplyStateCode;
}

export interface LineTax {
  cgst: Prisma.Decimal;
  sgst: Prisma.Decimal;
  igst: Prisma.Decimal;
  /** cgst + sgst + igst */
  totalTax: Prisma.Decimal;
}

export function computeLineTax(taxableValue: Prisma.Decimal, gstRatePct: Prisma.Decimal, interState: boolean): LineTax {
  if (taxableValue.isNegative()) throw new Error('Taxable value cannot be negative');
  if (gstRatePct.isNegative()) throw new Error('GST rate cannot be negative');
  if (interState) {
    const igst = roundMoney(taxableValue.mul(gstRatePct).div(100));
    return { cgst: ZERO, sgst: ZERO, igst, totalTax: igst };
  }
  const half = roundMoney(taxableValue.mul(gstRatePct).div(200));
  return { cgst: half, sgst: half, igst: ZERO, totalTax: half.mul(2) };
}

/**
 * Splits `total` across `weights` proportionally in whole paise (largest remainder, ties to the earlier index).
 * The result always sums to `total` exactly. Zero total weight yields all zeros.
 */
export function allocateProportionally(total: Prisma.Decimal, weights: Prisma.Decimal[]): Prisma.Decimal[] {
  const totalPaise = total.mul(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
  const sumWeights = weights.reduce((a, w) => a.add(w), ZERO);
  if (weights.length === 0) return [];
  if (sumWeights.lte(0) || totalPaise.lte(0)) return weights.map(() => ZERO);

  const exact = weights.map((w) => totalPaise.mul(w).div(sumWeights));
  const floors = exact.map((e) => e.floor());
  let remainder = totalPaise.sub(floors.reduce((a, f) => a.add(f), ZERO)).toNumber();
  const order = exact
    .map((e, i) => ({ i, frac: e.sub(floors[i]) }))
    .sort((a, b) => b.frac.comparedTo(a.frac) || a.i - b.i);
  const paise = floors.map((f) => f);
  for (const { i } of order) {
    if (remainder <= 0) break;
    paise[i] = paise[i].add(1);
    remainder -= 1;
  }
  return paise.map((p) => p.div(100));
}

export interface TaxedLine {
  lineTotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  taxableValue: Prisma.Decimal;
  cgst: Prisma.Decimal;
  sgst: Prisma.Decimal;
  igst: Prisma.Decimal;
  totalTax: Prisma.Decimal;
  /** taxableValue + totalTax */
  lineGrandTotal: Prisma.Decimal;
}

export function taxLine(
  unitPrice: Prisma.Decimal,
  quantity: number,
  discount: Prisma.Decimal,
  gstRatePct: Prisma.Decimal,
  interState: boolean,
): TaxedLine {
  const lineTotal = roundMoney(unitPrice.mul(quantity));
  const taxableValue = lineTotal.sub(discount);
  if (taxableValue.isNegative()) throw new Error('Discount exceeds the line total');
  const tax = computeLineTax(taxableValue, gstRatePct, interState);
  return { lineTotal, discount, taxableValue, ...tax, lineGrandTotal: taxableValue.add(tax.totalTax) };
}

export function sum(values: Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce((a, v) => a.add(v), ZERO);
}
