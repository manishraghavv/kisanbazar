import { Prisma } from '@prisma/client';

/** Orders at or above this subtotal (before tax and discount) ship free. */
export function deliveryFreeThreshold(env: NodeJS.ProcessEnv = process.env): Prisma.Decimal {
  return new Prisma.Decimal(env.DELIVERY_FREE_THRESHOLD ?? 500);
}

/** Flat delivery fee below the free-delivery threshold. */
export function deliveryFlatCharge(env: NodeJS.ProcessEnv = process.env): Prisma.Decimal {
  return new Prisma.Decimal(env.DELIVERY_CHARGE ?? 40);
}

/**
 * The server is the only source of truth for the delivery charge; whatever the client sends is ignored.
 * Free for subtotals at or above the threshold and for FREE_DELIVERY coupons.
 */
export function computeDeliveryCharge(
  subtotal: Prisma.Decimal,
  couponType?: string | null,
  env: NodeJS.ProcessEnv = process.env,
): Prisma.Decimal {
  if (couponType === 'FREE_DELIVERY') return new Prisma.Decimal(0);
  if (subtotal.gte(deliveryFreeThreshold(env))) return new Prisma.Decimal(0);
  return deliveryFlatCharge(env);
}

/** Coupon discount on the subtotal, never more than the subtotal itself. */
export function computeCouponDiscount(
  subtotal: Prisma.Decimal,
  coupon: { type: string; value: Prisma.Decimal; maximumDiscount: Prisma.Decimal | null },
): Prisma.Decimal {
  let discount = new Prisma.Decimal(0);
  if (coupon.type === 'PERCENTAGE') {
    discount = subtotal.mul(coupon.value).div(100);
    if (coupon.maximumDiscount && discount.gt(coupon.maximumDiscount)) discount = coupon.maximumDiscount;
  } else if (coupon.type === 'FIXED') {
    discount = coupon.value;
  }
  if (discount.gt(subtotal)) discount = subtotal;
  return discount.toDecimalPlaces(2);
}
