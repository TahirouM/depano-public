import { describe, expect, it } from 'vitest';
import { canTransition, clientDisputeBlockedReason, nextStatuses } from './booking-machine';
import { Phone } from './dto';
import { clientCancellationIsFree, computeCommission, computePrice, quoteNeedsNewAuthorization } from './rules';

describe('booking machine', () => {
  it('lets the system start dispatch only for urgent bookings', () => {
    expect(canTransition('pending_payment', 'searching', 'system', 'urgent')).toBe(true);
    expect(canTransition('pending_payment', 'searching', 'system', 'scheduled')).toBe(false);
  });

  it('forbids a client from closing an intervention', () => {
    expect(canTransition('awaiting_code', 'closed', 'client', 'urgent')).toBe(false);
    expect(canTransition('awaiting_code', 'closed', 'artisan', 'urgent')).toBe(true);
  });

  it('requires a quote before work starts', () => {
    expect(canTransition('arrived', 'in_progress', 'artisan', 'urgent')).toBe(false);
    expect(nextStatuses('arrived', 'artisan', 'urgent')).toEqual(['quote_pending', 'awaiting_code']);
  });

  it('lets a client open a dispute on an active intervention', () => {
    expect(canTransition('en_route', 'disputed', 'client', 'scheduled')).toBe(true);
    expect(canTransition('closed', 'disputed', 'client', 'scheduled')).toBe(false);
  });
});

describe('pricing', () => {
  it('adds urgent fee and guarantee', () => {
    const p = computePrice({ basePriceCents: 8000, travelFeeCents: 2000, urgent: true, withGuarantee: true });
    expect(p.totalCents).toBe(8000 + 2000 + 3000 + 1000);
    expect(p.rangeMaxCents).toBe(16800);
  });

  it('never takes commission on travel-only', () => {
    expect(computeCommission({ capturedCents: 4000, travelOnly: true, commissionRate: 0.15 })).toBe(0);
    expect(computeCommission({ capturedCents: 10000, travelOnly: false, commissionRate: 0.15 })).toBe(1500);
  });

  it('flags quotes above +20 %', () => {
    expect(quoteNeedsNewAuthorization(12000, 10000)).toBe(false);
    expect(quoteNeedsNewAuthorization(12001, 10000)).toBe(true);
  });

  it('free cancellation only during the first hour after booking', () => {
    const now = new Date('2026-10-19T10:00:00Z');
    const base = { now, hasGuarantee: false, status: 'accepted' };
    expect(clientCancellationIsFree({ ...base, bookedAt: new Date('2026-10-19T09:15:00Z') })).toBe(true);
    expect(clientCancellationIsFree({ ...base, bookedAt: new Date('2026-10-19T09:00:00Z') })).toBe(true);
    expect(clientCancellationIsFree({ ...base, bookedAt: new Date('2026-10-19T08:30:00Z') })).toBe(false);
    expect(clientCancellationIsFree({ ...base, bookedAt: new Date('2026-10-18T10:00:00Z'), hasGuarantee: true })).toBe(true);
    expect(clientCancellationIsFree({ ...base, bookedAt: new Date('2026-10-18T10:00:00Z'), artisanLateMinutes: 31 })).toBe(true);
    expect(clientCancellationIsFree({ ...base, bookedAt: new Date('2026-10-18T10:00:00Z'), status: 'requested' })).toBe(true);
  });
});

describe('phone', () => {
  it('normalises French mobile numbers', () => {
    expect(Phone.parse('06 12 34 56 78')).toBe('+33612345678');
    expect(() => Phone.parse('1234')).toThrow();
  });
});

describe('clientDisputeBlockedReason', () => {
  const now = new Date('2026-10-20T10:00:00Z');
  it('blocks a dispute on a future scheduled appointment', () => {
    expect(clientDisputeBlockedReason({ status: 'accepted', scheduledAt: '2026-10-21T08:00:00Z' }, now)).toMatch(/pas encore eu lieu/);
  });
  it('allows it once the appointment time has passed or the artisan is on the way', () => {
    expect(clientDisputeBlockedReason({ status: 'accepted', scheduledAt: new Date('2026-10-20T09:00:00Z') }, now)).toBeNull();
    expect(clientDisputeBlockedReason({ status: 'en_route', scheduledAt: '2026-10-21T08:00:00Z' }, now)).toBeNull();
    expect(clientDisputeBlockedReason({ status: 'accepted', scheduledAt: null }, now)).toBeNull();
  });
});
