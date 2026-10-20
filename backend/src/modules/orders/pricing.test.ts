import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { computeCouponDiscount, computeDeliveryCharge } from './pricing';

const D = (v: number | string) => new Prisma.Decimal(v);
const env = {} as NodeJS.ProcessEnv;

describe('computeDeliveryCharge', () => {
  it('charges the flat fee below the free-delivery threshold', () => {
    expect(computeDeliveryCharge(D(499.99), null, env).toString()).toBe('40');
  });
  it('is free at and above the threshold', () => {
    expect(computeDeliveryCharge(D(500), null, env).toString()).toBe('0');
    expect(computeDeliveryCharge(D(10_000), null, env).toString()).toBe('0');
  });
  it('is free with a FREE_DELIVERY coupon', () => {
    expect(computeDeliveryCharge(D(10), 'FREE_DELIVERY', env).toString()).toBe('0');
  });
  it('is configurable through the environment', () => {
    const custom = { DELIVERY_FREE_THRESHOLD: '1000', DELIVERY_CHARGE: '75' } as unknown as NodeJS.ProcessEnv;
    expect(computeDeliveryCharge(D(999), null, custom).toString()).toBe('75');
    expect(computeDeliveryCharge(D(1000), null, custom).toString()).toBe('0');
  });
});

describe('computeCouponDiscount', () => {
  it('applies a percentage, capped by maximumDiscount', () => {
    const coupon = { type: 'PERCENTAGE', value: D(10), maximumDiscount: D(50) };
    expect(computeCouponDiscount(D(300), coupon).toString()).toBe('30');
    expect(computeCouponDiscount(D(1000), coupon).toString()).toBe('50');
  });
  it('never discounts more than the subtotal', () => {
    expect(computeCouponDiscount(D(80), { type: 'FIXED', value: D(100), maximumDiscount: null }).toString()).toBe('80');
  });
  it('gives no discount for FREE_DELIVERY coupons (they remove the delivery fee instead)', () => {
    expect(
      computeCouponDiscount(D(300), { type: 'FREE_DELIVERY', value: D(50), maximumDiscount: null }).toString(),
    ).toBe('0');
  });
  it('uses exact decimal arithmetic', () => {
    expect(
      computeCouponDiscount(D('0.3'), { type: 'PERCENTAGE', value: D(10), maximumDiscount: null }).toString(),
    ).toBe('0.03');
  });
});
