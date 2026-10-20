import { describe, expect, it } from 'vitest';
import { canVendorTransition, deriveOrderStatus } from './orderStatus';

describe('deriveOrderStatus', () => {
  it('a single sub-order mirrors its own status', () => {
    for (const s of ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const) {
      expect(deriveOrderStatus([s])).toBe(s);
    }
  });
  it('the least advanced active sub-order decides', () => {
    expect(deriveOrderStatus(['SHIPPED', 'PROCESSING'])).toBe('PROCESSING');
    expect(deriveOrderStatus(['DELIVERED', 'SHIPPED', 'DELIVERED'])).toBe('SHIPPED');
    expect(deriveOrderStatus(['PENDING', 'DELIVERED'])).toBe('PENDING');
  });
  it('is DELIVERED only when every vendor has delivered', () => {
    expect(deriveOrderStatus(['DELIVERED', 'DELIVERED'])).toBe('DELIVERED');
  });
  it('ignores cancelled sub-orders unless all are cancelled', () => {
    expect(deriveOrderStatus(['CANCELLED', 'SHIPPED'])).toBe('SHIPPED');
    expect(deriveOrderStatus(['CANCELLED', 'CANCELLED'])).toBe('CANCELLED');
  });
  it('treats returned/refunded as delivered for progress, and reports RETURNED/REFUNDED when all are', () => {
    expect(deriveOrderStatus(['RETURNED', 'DELIVERED'])).toBe('DELIVERED');
    expect(deriveOrderStatus(['RETURNED', 'SHIPPED'])).toBe('SHIPPED');
    expect(deriveOrderStatus(['RETURNED', 'REFUNDED'])).toBe('RETURNED');
    expect(deriveOrderStatus(['REFUNDED', 'CANCELLED'])).toBe('REFUNDED');
    expect(deriveOrderStatus(['REFUNDED', 'REFUNDED'])).toBe('REFUNDED');
  });
});

describe('canVendorTransition', () => {
  it('follows the fulfilment chain', () => {
    expect(canVendorTransition('PENDING', 'CONFIRMED')).toBe(true);
    expect(canVendorTransition('PACKED', 'SHIPPED')).toBe(true);
    expect(canVendorTransition('SHIPPED', 'DELIVERED')).toBe(true);
  });
  it('allows reject/cancel only before packing is done', () => {
    expect(canVendorTransition('PENDING', 'CANCELLED')).toBe(true);
    expect(canVendorTransition('PROCESSING', 'CANCELLED')).toBe(true);
    expect(canVendorTransition('PACKED', 'CANCELLED')).toBe(false);
    expect(canVendorTransition('SHIPPED', 'CANCELLED')).toBe(false);
  });
  it('forbids skipping and going back; returns are not a vendor status call', () => {
    expect(canVendorTransition('PENDING', 'SHIPPED')).toBe(false);
    expect(canVendorTransition('DELIVERED', 'PENDING')).toBe(false);
    expect(canVendorTransition('DELIVERED', 'RETURNED')).toBe(false);
  });
});
