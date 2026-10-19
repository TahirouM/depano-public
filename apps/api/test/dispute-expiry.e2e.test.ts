import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from '@depano/db';
import * as s from '@depano/db';
import { call, createTestApp, PHONES, resetState, seedFixtures, tokenOf, type Fixtures, type TestContext } from './helpers';
import { urgentAwaitingCode, urgentSearching } from './flows';

describe('Litiges et expiration du dispatch', () => {
  let ctx: TestContext;
  let fx: Fixtures;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => {
    await resetState(ctx);
    fx = await seedFixtures(ctx.db);
  });

  it('litige : capture gelée puis capture partielle arbitrée par le support', async () => {
    const { id, client } = await urgentAwaitingCode(ctx, fx, 15000);
    const d = await call(ctx, 'POST', `/bookings/${id}/dispute`, { token: client, body: { reason: 'poor_quality', description: 'Fuite toujours présente' } });
    expect(d.status).toBe(200);
    expect(d.body.status).toBe('disputed');
    expect(d.body.dispute).toMatchObject({ reason: 'poor_quality', status: 'open' });
    // L'auto-capture ne s'applique pas
    expect(((await ctx.jobs.run('bookings', 'auto-capture')) as any).skipped).toBe(true);

    const support = await tokenOf(ctx, PHONES.support);
    const list = await call(ctx, 'GET', '/admin/disputes?status=open', { token: support });
    expect(list.body).toHaveLength(1);
    const row = list.body[0];
    expect(new Date(row.dueAt).getTime() - new Date(row.createdAt).getTime()).toBeCloseTo(72 * 3600_000, -4);
    const tooHigh = await call(ctx, 'POST', `/admin/disputes/${row.id}/resolve`, { token: support, body: { resolution: 'partial_capture', captureCents: 999999, note: 'Test' } });
    expect(tooHigh.status).toBe(400);
    const res = await call(ctx, 'POST', `/admin/disputes/${row.id}/resolve`, { token: support, body: { resolution: 'partial_capture', captureCents: 10000, note: 'Geste commercial de 45 €' } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'resolved', resolution: 'partial_capture', refundedCents: 5000 });
    const b = (await call(ctx, 'GET', `/bookings/${id}`, { token: client })).body;
    expect(b).toMatchObject({ status: 'closed', capturedCents: 10000 });
    const [row2] = await ctx.db.select().from(s.bookings).where(eq(s.bookings.id, id));
    expect(row2!.commissionCents).toBe(1500);
    const audit = await ctx.db.select().from(s.auditLogs).where(eq(s.auditLogs.action, 'dispute.resolve'));
    expect(audit).toHaveLength(1);
    expect((await call(ctx, 'POST', `/admin/disputes/${row.id}/resolve`, { token: support, body: { resolution: 'full_refund', note: 'Again' } })).status).toBe(409);
  });

  it('litige : remboursement intégral ⇒ empreinte libérée, annulée côté artisan', async () => {
    const { id, client } = await urgentAwaitingCode(ctx, fx, 15000);
    await call(ctx, 'POST', `/bookings/${id}/dispute`, { token: client, body: { reason: 'never_came' } });
    const admin = await tokenOf(ctx, PHONES.admin);
    const [dispute] = await ctx.db.select().from(s.disputes).where(eq(s.disputes.bookingId, id));
    const r = await call(ctx, 'POST', `/admin/disputes/${dispute!.id}/resolve`, { token: admin, body: { resolution: 'full_refund', note: 'Artisan absent' } });
    expect(r.body).toMatchObject({ resolution: 'full_refund', refundedCents: 15000 });
    const [b] = await ctx.db.select().from(s.bookings).where(eq(s.bookings.id, id));
    expect(b!.status).toBe('cancelled_by_artisan');
    const pays = await ctx.db.select().from(s.payments).where(eq(s.payments.bookingId, id));
    expect(pays.every((p) => p.status === 'cancelled')).toBe(true);
  });

  it('frais de déplacement seuls : capture sans commission', async () => {
    const { id, client } = await urgentAwaitingCode(ctx, fx, 15000);
    await call(ctx, 'POST', `/bookings/${id}/dispute`, { token: client, body: { reason: 'travel_only' } });
    const support = await tokenOf(ctx, PHONES.support);
    const [dispute] = await ctx.db.select().from(s.disputes).where(eq(s.disputes.bookingId, id));
    await call(ctx, 'POST', `/admin/disputes/${dispute!.id}/resolve`, { token: support, body: { resolution: 'travel_fee_only', note: 'Diagnostic seul' } });
    const [b] = await ctx.db.select().from(s.bookings).where(eq(s.bookings.id, id));
    expect(b).toMatchObject({ status: 'closed', capturedCents: 2500, commissionCents: 0, travelOnly: true });
  });

  it('3 vagues sans preneur ⇒ expired, empreinte libérée, alternative proposée', async () => {
    const { id, client } = await urgentSearching(ctx, fx);
    expect(ctx.realtime.of('offer.created')).toHaveLength(3);
    // Vague 1 expirée : plus aucun candidat ⇒ vagues 2 et 3 vides
    await ctx.jobs.run('dispatch', 'wave-timeout', (d) => d.wave === 1);
    const [mid] = await ctx.db.select().from(s.bookings).where(eq(s.bookings.id, id));
    expect(mid!.status).toBe('searching');
    expect(mid!.dispatchWave).toBe(3);
    expect(ctx.realtime.of('offer.revoked').filter((e) => e.payload.reason === 'expired')).toHaveLength(3);
    const r = (await ctx.jobs.run('dispatch', 'wave-timeout', (d) => d.wave === 3)) as any;
    expect(r.expired).toBe(true);
    const d = (await call(ctx, 'GET', `/bookings/${id}`, { token: client })).body;
    expect(d.status).toBe('expired');
    expect(d.dispatch).toMatchObject({ wave: 3, contacted: 3, radiusKm: 20 });
    const pays = await ctx.db.select().from(s.payments).where(eq(s.payments.bookingId, id));
    expect(pays[0]!.status).toBe('cancelled');
    const notifs = (await call(ctx, 'GET', '/notifications', { token: client })).body.items;
    const expired = notifs.find((n: any) => n.type === 'booking_expired');
    expect(expired.data.alternative).toMatchObject({ artisanId: expect.any(String), slotAt: expect.any(String) });
    // Les offres expirées ne peuvent plus être acceptées
    const t1 = await tokenOf(ctx, PHONES.artisan1);
    const [offer] = await ctx.db.select().from(s.dispatchOffers).where(eq(s.dispatchOffers.artisanId, fx.artisans.a1));
    expect((await call(ctx, 'POST', `/artisan/offers/${offer!.id}/accept`, { token: t1 })).status).toBe(410);
  });

  it('refus de tous les artisans : la vague suivante part sans attendre', async () => {
    const { id } = await urgentSearching(ctx, fx);
    for (const phone of [PHONES.artisan1, PHONES.artisan2, PHONES.artisan3]) {
      const t = await tokenOf(ctx, phone);
      const offers = (await call(ctx, 'GET', '/artisan/offers', { token: t })).body;
      expect((await call(ctx, 'POST', `/artisan/offers/${offers[0].id}/decline`, { token: t })).status).toBe(204);
    }
    const timeouts = ctx.jobs.find('dispatch', 'wave-timeout').filter((j) => j.data.bookingId === id && !j.opts.delayMs);
    expect(timeouts).toHaveLength(1);
  });
});
