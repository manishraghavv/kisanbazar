import { Prisma } from '@prisma/client';
import { allocateProportionally, isInterState, roundMoney, sum, taxLine, ZERO, TaxedLine } from '../gst/gst';
import { computeCouponDiscount, computeDeliveryCharge } from './pricing';

/**
 * Pure order pricing: splits a cart into one sub-order per vendor, allocates the coupon discount, applies GST per
 * line (see gst/gst.ts for the rules) and the server-side delivery charge per sub-order.
 * Used by both checkout (inside the transaction, with locked prices) and the read-only quote endpoint.
 */

export interface PricingLineInput {
  variantId: string;
  productId: string;
  vendorId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  gstRatePct: Prisma.Decimal;
  hsnCode: string | null;
  commissionRatePct: Prisma.Decimal;
}

export interface PricingCoupon {
  type: string;
  value: Prisma.Decimal;
  minimumAmount: Prisma.Decimal | null;
  maximumDiscount: Prisma.Decimal | null;
  /** Set for vendor-scoped coupons: only that vendor's sub-orders are eligible. */
  vendorId: string | null;
}

export interface PricedLine extends PricingLineInput, TaxedLine {
  commissionAmount: Prisma.Decimal;
}

export interface PricedSubOrder {
  vendorId: string;
  sellerStateCode: string;
  placeOfSupply: string;
  interState: boolean;
  lines: PricedLine[];
  /** sum of line totals (before discount, before tax) */
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxableValue: Prisma.Decimal;
  cgstAmount: Prisma.Decimal;
  sgstAmount: Prisma.Decimal;
  igstAmount: Prisma.Decimal;
  gstAmount: Prisma.Decimal;
  deliveryCharge: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  commissionAmount: Prisma.Decimal;
  /** True when a FREE_DELIVERY coupon applied to this sub-order. */
  freeDeliveryCoupon: boolean;
}

export interface PricedOrder {
  subOrders: PricedSubOrder[];
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxableValue: Prisma.Decimal;
  cgstAmount: Prisma.Decimal;
  sgstAmount: Prisma.Decimal;
  igstAmount: Prisma.Decimal;
  gstAmount: Prisma.Decimal;
  deliveryCharge: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
}

export class PricingError extends Error {
  constructor(
    message: string,
    readonly code: 'COUPON_MIN_AMOUNT' | 'COUPON_NOT_APPLICABLE' | 'VENDOR_STATE_MISSING',
  ) {
    super(message);
  }
}

export function priceOrder(input: {
  lines: PricingLineInput[];
  /** vendorId -> GST state code of the seller */
  vendorStateCodes: Map<string, string | null>;
  /** buyer's state code = place of supply */
  placeOfSupply: string;
  coupon?: PricingCoupon | null;
  env?: NodeJS.ProcessEnv;
}): PricedOrder {
  const { lines, vendorStateCodes, placeOfSupply, coupon } = input;

  // Group by vendor in a stable order so sub-order numbers are deterministic.
  const vendorIds = [...new Set(lines.map((l) => l.vendorId))].sort();
  for (const vendorId of vendorIds) {
    if (!vendorStateCodes.get(vendorId)) {
      throw new PricingError('A seller on this order has not set a GST state yet', 'VENDOR_STATE_MISSING');
    }
  }

  // Coupon eligibility and discount (computed on the eligible subtotal, allocated over eligible lines).
  const eligible = (l: PricingLineInput) => !coupon || !coupon.vendorId || coupon.vendorId === l.vendorId;
  const lineTotals = lines.map((l) => roundMoney(l.unitPrice.mul(l.quantity)));
  const eligibleIdx = lines.map((l, i) => (eligible(l) ? i : -1)).filter((i) => i >= 0);
  const eligibleSubtotal = sum(eligibleIdx.map((i) => lineTotals[i]));
  const discounts = lines.map(() => ZERO);
  if (coupon) {
    if (eligibleIdx.length === 0) {
      throw new PricingError('This coupon only applies to a different seller', 'COUPON_NOT_APPLICABLE');
    }
    if (coupon.minimumAmount && eligibleSubtotal.lt(coupon.minimumAmount)) {
      throw new PricingError(`Minimum order amount of ₹${coupon.minimumAmount} not met`, 'COUPON_MIN_AMOUNT');
    }
    const discount = computeCouponDiscount(eligibleSubtotal, coupon);
    const parts = allocateProportionally(
      discount,
      eligibleIdx.map((i) => lineTotals[i]),
    );
    eligibleIdx.forEach((lineIdx, k) => {
      discounts[lineIdx] = parts[k];
    });
  }

  const subOrders: PricedSubOrder[] = vendorIds.map((vendorId) => {
    const sellerStateCode = vendorStateCodes.get(vendorId)!;
    const interState = isInterState(sellerStateCode, placeOfSupply);
    const pricedLines: PricedLine[] = [];
    lines.forEach((l, i) => {
      if (l.vendorId !== vendorId) return;
      const taxed = taxLine(l.unitPrice, l.quantity, discounts[i], l.gstRatePct, interState);
      pricedLines.push({
        ...l,
        ...taxed,
        commissionAmount: roundMoney(taxed.taxableValue.mul(l.commissionRatePct).div(100)),
      });
    });
    const subtotal = sum(pricedLines.map((l) => l.lineTotal));
    const taxableValue = sum(pricedLines.map((l) => l.taxableValue));
    const cgstAmount = sum(pricedLines.map((l) => l.cgst));
    const sgstAmount = sum(pricedLines.map((l) => l.sgst));
    const igstAmount = sum(pricedLines.map((l) => l.igst));
    const freeDeliveryCoupon =
      !!coupon && coupon.type === 'FREE_DELIVERY' && (!coupon.vendorId || coupon.vendorId === vendorId);
    const deliveryCharge = computeDeliveryCharge(subtotal, freeDeliveryCoupon ? 'FREE_DELIVERY' : null, input.env);
    const gstAmount = cgstAmount.add(sgstAmount).add(igstAmount);
    return {
      vendorId,
      sellerStateCode,
      placeOfSupply,
      interState,
      lines: pricedLines,
      subtotal,
      discountAmount: sum(pricedLines.map((l) => l.discount)),
      taxableValue,
      cgstAmount,
      sgstAmount,
      igstAmount,
      gstAmount,
      deliveryCharge,
      totalAmount: taxableValue.add(gstAmount).add(deliveryCharge),
      commissionAmount: sum(pricedLines.map((l) => l.commissionAmount)),
      freeDeliveryCoupon,
    };
  });

  const pick = (f: (s: PricedSubOrder) => Prisma.Decimal) => sum(subOrders.map(f));
  return {
    subOrders,
    subtotal: pick((s) => s.subtotal),
    discountAmount: pick((s) => s.discountAmount),
    taxableValue: pick((s) => s.taxableValue),
    cgstAmount: pick((s) => s.cgstAmount),
    sgstAmount: pick((s) => s.sgstAmount),
    igstAmount: pick((s) => s.igstAmount),
    gstAmount: pick((s) => s.gstAmount),
    deliveryCharge: pick((s) => s.deliveryCharge),
    totalAmount: pick((s) => s.totalAmount),
  };
}
