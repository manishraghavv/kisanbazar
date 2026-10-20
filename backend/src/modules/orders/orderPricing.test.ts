import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { PricingCoupon, PricingError, PricingLineInput, priceOrder } from './orderPricing';

const D = (v: number | string) => new Prisma.Decimal(v);
const s = (d: Prisma.Decimal) => d.toString();
const env = {} as NodeJS.ProcessEnv;

let n = 0;
const line = (vendorId: string, unitPrice: number | string, quantity: number, gst: number): PricingLineInput => ({
  variantId: `v${++n}`,
  productId: `p${n}`,
  vendorId,
  quantity,
  unitPrice: D(unitPrice),
  gstRatePct: D(gst),
  hsnCode: '3102',
  commissionRatePct: D(10),
});
const states = new Map<string, string | null>([
  ['A', '09'], // Uttar Pradesh
  ['B', '27'], // Maharashtra
  ['C', '29'], // Karnataka
]);

describe('priceOrder', () => {
  it('same-state buyer: CGST + SGST', () => {
    const r = priceOrder({ lines: [line('A', 1000, 1, 18)], vendorStateCodes: states, placeOfSupply: '09', env });
    const so = r.subOrders[0];
    expect(so.interState).toBe(false);
    expect([s(so.cgstAmount), s(so.sgstAmount), s(so.igstAmount)]).toEqual(['90', '90', '0']);
    expect(s(so.totalAmount)).toBe('1180'); // free delivery over 500
  });

  it('cross-state buyer: IGST', () => {
    const r = priceOrder({ lines: [line('B', 1000, 1, 18)], vendorStateCodes: states, placeOfSupply: '09', env });
    const so = r.subOrders[0];
    expect(so.interState).toBe(true);
    expect([s(so.cgstAmount), s(so.sgstAmount), s(so.igstAmount)]).toEqual(['0', '0', '180']);
    expect(s(so.totalAmount)).toBe('1180');
  });

  it('three vendors in three states split into three sub-orders with mixed regimes and rates', () => {
    const r = priceOrder({
      lines: [line('A', 100, 2, 5), line('B', 400, 1, 12), line('C', 50, 3, 18), line('B', 100, 1, 0)],
      vendorStateCodes: states,
      placeOfSupply: '09',
      env,
    });
    expect(r.subOrders.map((x) => x.vendorId)).toEqual(['A', 'B', 'C']);
    const [a, b, c] = r.subOrders;
    // A: intra-state, 200 @5% => 5 + 5, delivery 40 (200 < 500)
    expect([s(a.cgstAmount), s(a.sgstAmount), s(a.igstAmount), s(a.deliveryCharge), s(a.totalAmount)]).toEqual([
      '5',
      '5',
      '0',
      '40',
      '250',
    ]);
    // B: inter-state, 400 @12% => 48 IGST; 100 @0% => 0; subtotal 500 => free delivery
    expect([s(b.igstAmount), s(b.deliveryCharge), s(b.totalAmount)]).toEqual(['48', '0', '548']);
    // C: inter-state, 150 @18% => 27 IGST, delivery 40
    expect([s(c.igstAmount), s(c.deliveryCharge), s(c.totalAmount)]).toEqual(['27', '40', '217']);
    expect(s(r.totalAmount)).toBe(s(a.totalAmount.add(b.totalAmount).add(c.totalAmount)));
    expect(s(r.gstAmount)).toBe('85'); // 10 + 48 + 27
    expect(s(r.deliveryCharge)).toBe('80');
  });

  it('allocates a percentage coupon across lines and taxes the discounted value', () => {
    const coupon: PricingCoupon = {
      type: 'PERCENTAGE',
      value: D(10),
      minimumAmount: null,
      maximumDiscount: null,
      vendorId: null,
    };
    const r = priceOrder({
      lines: [line('A', 600, 1, 18), line('B', 400, 1, 5)],
      vendorStateCodes: states,
      placeOfSupply: '09',
      coupon,
      env,
    });
    const [a, b] = r.subOrders;
    expect(s(r.discountAmount)).toBe('100');
    expect(s(a.discountAmount)).toBe('60');
    expect(s(b.discountAmount)).toBe('40');
    expect(s(a.taxableValue)).toBe('540');
    expect([s(a.cgstAmount), s(a.sgstAmount)]).toEqual(['48.6', '48.6']);
    expect(s(b.taxableValue)).toBe('360');
    expect(s(b.igstAmount)).toBe('18'); // 360 @5%
  });

  it('discount allocation never loses or invents a paisa', () => {
    const coupon: PricingCoupon = {
      type: 'FIXED',
      value: D('10.00'),
      minimumAmount: null,
      maximumDiscount: null,
      vendorId: null,
    };
    const r = priceOrder({
      lines: [line('A', '33.33', 1, 5), line('B', '33.33', 1, 5), line('C', '33.34', 1, 5)],
      vendorStateCodes: states,
      placeOfSupply: '09',
      coupon,
      env,
    });
    expect(s(r.discountAmount)).toBe('10');
    expect(r.subOrders.every((x) => x.discountAmount.gte(0))).toBe(true);
  });

  it('a vendor-scoped coupon only discounts that vendor', () => {
    const coupon: PricingCoupon = {
      type: 'FIXED',
      value: D(50),
      minimumAmount: D(100),
      maximumDiscount: null,
      vendorId: 'B',
    };
    const r = priceOrder({
      lines: [line('A', 300, 1, 5), line('B', 200, 1, 5)],
      vendorStateCodes: states,
      placeOfSupply: '27',
      coupon,
      env,
    });
    expect(s(r.subOrders[0].discountAmount)).toBe('0');
    expect(s(r.subOrders[1].discountAmount)).toBe('50');
    expect(() =>
      priceOrder({ lines: [line('A', 300, 1, 5)], vendorStateCodes: states, placeOfSupply: '27', coupon, env }),
    ).toThrow(PricingError);
  });

  it('the coupon minimum is checked against the eligible subtotal only', () => {
    const coupon: PricingCoupon = {
      type: 'FIXED',
      value: D(10),
      minimumAmount: D(500),
      maximumDiscount: null,
      vendorId: 'B',
    };
    expect(() =>
      priceOrder({
        lines: [line('A', 900, 1, 5), line('B', 100, 1, 5)],
        vendorStateCodes: states,
        placeOfSupply: '27',
        coupon,
        env,
      }),
    ).toThrow(/Minimum order amount/);
  });

  it('FREE_DELIVERY removes the delivery fee on eligible sub-orders only', () => {
    const coupon: PricingCoupon = {
      type: 'FREE_DELIVERY',
      value: D(0),
      minimumAmount: null,
      maximumDiscount: null,
      vendorId: 'A',
    };
    const r = priceOrder({
      lines: [line('A', 100, 1, 0), line('B', 100, 1, 0)],
      vendorStateCodes: states,
      placeOfSupply: '09',
      coupon,
      env,
    });
    expect(s(r.subOrders[0].deliveryCharge)).toBe('0');
    expect(s(r.subOrders[1].deliveryCharge)).toBe('40');
    expect(s(r.discountAmount)).toBe('0');
  });

  it('refuses vendors with no GST state', () => {
    expect(() =>
      priceOrder({ lines: [line('Z', 100, 1, 5)], vendorStateCodes: new Map([['Z', null]]), placeOfSupply: '09', env }),
    ).toThrow(/GST state/);
  });

  it('computes commission on the discounted taxable value', () => {
    const coupon: PricingCoupon = {
      type: 'FIXED',
      value: D(100),
      minimumAmount: null,
      maximumDiscount: null,
      vendorId: null,
    };
    const r = priceOrder({
      lines: [line('A', 1000, 1, 18)],
      vendorStateCodes: states,
      placeOfSupply: '09',
      coupon,
      env,
    });
    expect(s(r.subOrders[0].commissionAmount)).toBe('90'); // 10% of 900
  });
});
