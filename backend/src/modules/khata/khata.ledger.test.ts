import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { nextStatus } from './khata.ledger';

const D = (v: number) => new Prisma.Decimal(v);

describe('nextStatus', () => {
  it('moves between ACTIVE and SETTLED with the balance', () => {
    expect(nextStatus('ACTIVE', D(0))).toBe('SETTLED');
    expect(nextStatus('SETTLED', D(10))).toBe('ACTIVE');
    expect(nextStatus('ACTIVE', D(10))).toBe('ACTIVE');
  });
  it('never overwrites OVERDUE or SUSPENDED because of a posting', () => {
    expect(nextStatus('OVERDUE', D(10))).toBe('OVERDUE');
    expect(nextStatus('SUSPENDED', D(10))).toBe('SUSPENDED');
    expect(nextStatus('WRITTEN_OFF', D(0))).toBe('WRITTEN_OFF');
  });
  it('settles an overdue account once it is fully paid', () => {
    expect(nextStatus('OVERDUE', D(0))).toBe('SETTLED');
  });
});
