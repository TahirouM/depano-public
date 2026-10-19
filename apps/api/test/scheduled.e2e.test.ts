import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from '@depano/db';
import * as s from '@depano/db';
import { call, createTestApp, PHONES, resetState, seedFixtures, tokenOf, type Fixtures, type TestContext } from './helpers';
import { addDays, parisDate } from '../src/common/time';

const INLINE = { line1: '5 rue de Rome', postalCode: '13001', city: 'Marseille', lat: 43.296, lng: 5.379 };

describe('Rendez-vous planifiés, créneaux et annulation', () => {
  let ctx: TestContext;
  let fx: Fixtures;
  let clientA: string;
  let clientB: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => {
    await resetState(ctx);
    fx = await seedFixtures(ctx.db);
    clientA = await tokenOf(ctx, PHONES.clientA);
    clientB = await tokenOf(ctx, PHONES.clientB);
  });

  async function slotIn(daysAhead: number) {
    const from = addDays(parisDate(new Date()), daysAhead);
    const r = await call(ctx, 'GET', `/artisans/${fx.artisans.a1}/slots?serviceId=${fx.services.fuite}&from=${from}&days=1`);
    expect(r.status).toBe(200);
    return r.body[0].slots[0] as string;
  }

  async function book(token: string, scheduledAt: string, extra: Record<string, unknown> = {}) {
    return call(ctx, 'POST', '/bookings', {
      token,
      body: { kind: 'scheduled', domain: 'plomberie', serviceId: fx.services.fuite, artisanId: fx.artisans.a1, scheduledAt, address: INLINE, problemReason: 'Robinet qui fuit', ...extra },
    });
  }

  it('calcule les créneaux en heure de Paris (pas de 30 min)', async () => {
    const from = addDays(parisDate(new Date()), 2);
    const r = await call(ctx, 'GET', `/artisans/${fx.artisans.a1}/slots?serviceId=${fx.services.fuite}&from=${from}&days=2`);
    expect(r.body).toHaveLength(2);
    const slots = r.body[0].slots as string[];
    // 08:00 → 19:00 (durée 60 min, fin 20:00) : 23 créneaux
    expect(slots).toHaveLength(23);
    const fmt = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
    expect(fmt.format(new Date(slots[0]!))).toBe('08:00');
    expect(fmt.format(new Date(slots[1]!))).toBe('08:30');
    expect(fmt.format(new Date(slots.at(-1)!))).toBe('19:00');
  });

  it('refuse la double réservation du même créneau', async () => {
    const at = await slotIn(2);
    const first = await book(clientA, at);
    expect(first.status).toBe(201);
    expect(first.body.booking.conversationId).toBeTruthy();
    const confirmed = await call(ctx, 'POST', `/bookings/${first.body.booking.id}/confirm-payment`, { token: clientA });
    expect(confirmed.body.status).toBe('accepted');
    expect(confirmed.body.completionCode).toMatch(/^\d{4}$/);
    expect(ctx.jobs.find('bookings', 'reminder').map((j) => j.data.kind).sort()).toEqual(['day_before', 'hour_before']);

    const second = await book(clientB, at);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('slot_unavailable');
    // Le créneau n'est plus proposé
    const from = parisDate(new Date(at));
    const slots = (await call(ctx, 'GET', `/artisans/${fx.artisans.a1}/slots?serviceId=${fx.services.fuite}&from=${from}&days=1`)).body[0].slots;
    expect(slots).not.toContain(at);
    // Même en concurrence, la contrainte d'exclusion protège
    const other = slots[4] as string;
    const [x, y] = await Promise.all([book(clientA, other), book(clientB, other)]);
    expect([x.status, y.status].sort()).toEqual([201, 409]);
  });

  it('RDV lointain : SetupIntent puis autorisation 24 h avant', async () => {
    const at = await slotIn(10);
    const r = await book(clientA, at);
    expect(r.body.payment.setupIntentId).toMatch(/^seti_fake_/);
    expect(r.body.payment.paymentIntentId).toBeNull();
    const c = await call(ctx, 'POST', `/bookings/${r.body.booking.id}/confirm-payment`, { token: clientA });
    expect(c.body.status).toBe('accepted');
    expect(c.body.authorizedCents).toBe(0);
    const res = (await ctx.jobs.run('bookings', 'authorize-scheduled')) as any;
    expect(res.authorized).toBe(true);
    expect((await call(ctx, 'GET', `/bookings/${r.body.booking.id}`, { token: clientA })).body.authorizedCents).toBe(9000 + 2500);
  });

  it('annulation gratuite plus de 2 h avant, frais de déplacement ensuite, gratuite avec garantie', async () => {
    // > 2 h : gratuite
    const free = await book(clientA, await slotIn(2));
    await call(ctx, 'POST', `/bookings/${free.body.booking.id}/confirm-payment`, { token: clientA });
    const d1 = (await call(ctx, 'GET', `/bookings/${free.body.booking.id}`, { token: clientA })).body;
    expect(d1).toMatchObject({ cancellationIsFree: true, cancellationFeeCents: 0 });
    const c1 = await call(ctx, 'POST', `/bookings/${free.body.booking.id}/cancel`, { token: clientA, body: { reason: 'Imprévu' } });
    expect(c1.body).toMatchObject({ status: 'cancelled_by_client', capturedCents: null });
    const p1 = await ctx.db.select().from(s.payments).where(eq(s.payments.bookingId, free.body.booking.id));
    expect(p1[0]!.status).toBe('cancelled');

    // < 2 h : frais de déplacement capturés, sans commission
    const late = await book(clientA, await slotIn(3));
    const lateId = late.body.booking.id;
    await call(ctx, 'POST', `/bookings/${lateId}/confirm-payment`, { token: clientA });
    const soon = new Date(Date.now() + 60 * 60_000);
    await ctx.db.update(s.bookings).set({ scheduledAt: soon, endsAt: new Date(soon.getTime() + 3600_000) }).where(eq(s.bookings.id, lateId));
    const d2 = (await call(ctx, 'GET', `/bookings/${lateId}`, { token: clientA })).body;
    expect(d2).toMatchObject({ cancellationIsFree: false, cancellationFeeCents: 2500 });
    const c2 = await call(ctx, 'POST', `/bookings/${lateId}/cancel`, { token: clientA, body: {} });
    expect(c2.body).toMatchObject({ status: 'cancelled_by_client', capturedCents: 2500 });
    const [b2] = await ctx.db.select().from(s.bookings).where(eq(s.bookings.id, lateId));
    expect(b2!.cancellationFeeCents).toBe(2500);
    expect(b2!.commissionCents).toBe(0);
    const p2 = await ctx.db.select().from(s.payments).where(eq(s.payments.bookingId, lateId));
    expect(p2[0]).toMatchObject({ status: 'partially_captured', capturedCents: 2500, applicationFeeCents: 0 });

    // < 2 h avec garantie annulation : gratuite
    const g = await book(clientA, await slotIn(4), { withGuarantee: true });
    expect(g.body.booking.price.guaranteeCents).toBe(1000);
    await call(ctx, 'POST', `/bookings/${g.body.booking.id}/confirm-payment`, { token: clientA });
    await ctx.db.update(s.bookings).set({ scheduledAt: soon, endsAt: new Date(soon.getTime() + 3600_000) }).where(eq(s.bookings.id, g.body.booking.id));
    const c3 = await call(ctx, 'POST', `/bookings/${g.body.booking.id}/cancel`, { token: clientA, body: {} });
    expect(c3.body).toMatchObject({ status: 'cancelled_by_client', capturedCents: null, cancellationFeeCents: 0 });
  });

  it("annulations artisan : fiabilité, puis suspension des urgences après 3 en 30 jours", async () => {
    const artisan = await tokenOf(ctx, PHONES.artisan1);
    for (let i = 0; i < 3; i++) {
      const b = await book(clientA, await slotIn(2 + i));
      await call(ctx, 'POST', `/bookings/${b.body.booking.id}/confirm-payment`, { token: clientA });
      const c = await call(ctx, 'POST', `/bookings/${b.body.booking.id}/cancel`, { token: artisan, body: { reason: 'Malade' } });
      expect(c.body.status).toBe('cancelled_by_artisan');
    }
    const [p] = await ctx.db.select().from(s.artisanProfiles).where(eq(s.artisanProfiles.id, fx.artisans.a1));
    expect(p!.reliabilityScore).toBe(70);
    expect(p!.urgentAvailable).toBe(false);
    expect(p!.urgentSuspendedUntil!.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
    const r = await call(ctx, 'PUT', '/artisan/urgent-availability', { token: artisan, body: { available: true } });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('urgent_suspended');
    expect((await call(ctx, 'GET', '/artisan/stats', { token: artisan })).body.cancellations30d).toBe(3);
  });
});
