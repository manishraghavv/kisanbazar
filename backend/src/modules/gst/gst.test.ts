import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { allocateProportionally, computeLineTax, isInterState, roundMoney, sum, taxLine } from './gst';
import { isValidGstin, isValidStateCode, stateCodeFromGstin, stateName } from './states';

const D = (v: number | string) => new Prisma.Decimal(v);
const s = (d: Prisma.Decimal) => d.toString();

describe('computeLineTax', () => {
  it('intra-state: CGST + SGST at half the rate each', () => {
    const t = computeLineTax(D(1000), D(18), false);
    expect([s(t.cgst), s(t.sgst), s(t.igst), s(t.totalTax)]).toEqual(['90', '90', '0', '180']);
  });
  it('inter-state: IGST at the full rate', () => {
    const t = computeLineTax(D(1000), D(18), true);
    expect([s(t.cgst), s(t.sgst), s(t.igst), s(t.totalTax)]).toEqual(['0', '0', '180', '180']);
  });
  it('zero-rated goods carry no tax', () => {
    expect(s(computeLineTax(D(500), D(0), false).totalTax)).toBe('0');
    expect(s(computeLineTax(D(500), D(0), true).totalTax)).toBe('0');
  });
  it('rounds half-up per line and independently for CGST and SGST', () => {
    // 0.10 at 5%: half = 0.0025 -> 0.00 each; IGST would be 0.005 -> 0.01
    expect(s(computeLineTax(D('0.10'), D(5), false).totalTax)).toBe('0');
    expect(s(computeLineTax(D('0.10'), D(5), true).totalTax)).toBe('0.01');
    // 33.33 at 12%: half = 1.9998 -> 2.00 each
    const t = computeLineTax(D('33.33'), D(12), false);
    expect([s(t.cgst), s(t.sgst)]).toEqual(['2', '2']);
    // 10.10 at 5%: half = 0.2525 -> 0.25 ; IGST = 0.505 -> 0.51 (half-up)
    expect(s(computeLineTax(D('10.10'), D(5), false).cgst)).toBe('0.25');
    expect(s(computeLineTax(D('10.10'), D(5), true).igst)).toBe('0.51');
  });
  it('uses exact decimal arithmetic (no float drift)', () => {
    // 0.29 * 100 is 28.999999999999996 in floats
    expect(s(computeLineTax(D('0.29'), D(100), true).igst)).toBe('0.29');
  });
  it('rejects negative inputs', () => {
    expect(() => computeLineTax(D(-1), D(5), true)).toThrow();
    expect(() => computeLineTax(D(1), D(-5), true)).toThrow();
  });
});

describe('isInterState', () => {
  it('compares seller state with the place of supply', () => {
    expect(isInterState('09', '09')).toBe(false);
    expect(isInterState('27', '09')).toBe(true);
  });
});

describe('allocateProportionally (discount allocation)', () => {
  it('splits proportionally and always sums exactly', () => {
    const parts = allocateProportionally(D(100), [D(100), D(200), D(700)]);
    expect(parts.map(s)).toEqual(['10', '20', '70']);
  });
  it('distributes the leftover paise by largest remainder', () => {
    const parts = allocateProportionally(D('10.00'), [D(1), D(1), D(1)]);
    expect(parts.map(s)).toEqual(['3.34', '3.33', '3.33']);
    expect(s(sum(parts))).toBe('10');
  });
  it('sums exactly for awkward weights', () => {
    const weights = [D('33.33'), D('66.67'), D('0.01'), D('199.99')];
    const parts = allocateProportionally(D('47.13'), weights);
    expect(s(sum(parts))).toBe('47.13');
    parts.forEach((p, i) => expect(p.lte(weights[i])).toBe(true));
  });
  it('handles zero discount / zero weights', () => {
    expect(allocateProportionally(D(0), [D(5), D(5)]).map(s)).toEqual(['0', '0']);
    expect(allocateProportionally(D(5), [D(0), D(0)]).map(s)).toEqual(['0', '0']);
    expect(allocateProportionally(D(5), [])).toEqual([]);
  });
});

describe('taxLine', () => {
  it('reduces the taxable value by the allocated discount before tax', () => {
    const t = taxLine(D(100), 3, D(30), D(18), false); // 300 - 30 = 270 taxable
    expect(s(t.lineTotal)).toBe('300');
    expect(s(t.taxableValue)).toBe('270');
    expect([s(t.cgst), s(t.sgst)]).toEqual(['24.3', '24.3']);
    expect(s(t.lineGrandTotal)).toBe('318.6');
  });
  it('rejects a discount larger than the line', () => {
    expect(() => taxLine(D(10), 1, D(11), D(5), true)).toThrow();
  });
});

describe('roundMoney', () => {
  it('rounds half away from zero', () => {
    expect(s(roundMoney(D('1.005')))).toBe('1.01');
    expect(s(roundMoney(D('1.004')))).toBe('1');
  });
});

describe('GST identifiers', () => {
  it('knows the state codes', () => {
    expect(isValidStateCode('09')).toBe(true);
    expect(isValidStateCode('27')).toBe(true);
    expect(isValidStateCode('25')).toBe(false); // retired code
    expect(isValidStateCode('99')).toBe(false);
    expect(isValidStateCode(9)).toBe(false);
    expect(stateName('29')).toBe('Karnataka');
  });
  it('validates GSTIN format and state prefix', () => {
    expect(isValidGstin('09AAAAA0000A1Z5')).toBe(true);
    expect(isValidGstin('27AAPFU0939F1ZV')).toBe(true);
    expect(isValidGstin('99AAAAA0000A1Z5')).toBe(false);
    expect(isValidGstin('09AAAAA0000A1X5')).toBe(false);
    expect(isValidGstin('nope')).toBe(false);
    expect(stateCodeFromGstin('29AAAAA0000A1Z5')).toBe('29');
    expect(stateCodeFromGstin('bad')).toBeUndefined();
  });
});
