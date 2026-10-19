import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { call, createTestApp, PHONES, resetState, seedFixtures, tokenOf, type Fixtures, type TestContext } from './helpers';

describe('Contrôle d’accès (rôles et propriété)', () => {
  let ctx: TestContext;
  let fx: Fixtures;
  let bookingId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => {
    await resetState(ctx);
    fx = await seedFixtures(ctx.db);
    const client = await tokenOf(ctx, PHONES.clientA);
    const r = await call(ctx, 'POST', '/bookings', {
      token: client,
      body: { kind: 'urgent', domain: 'plomberie', serviceId: fx.services.fuite, addressId: fx.addressA, problemReason: 'Fuite', waivesWithdrawal: true },
    });
    expect(r.status).toBe(201);
    bookingId = r.body.booking.id;
    await call(ctx, 'POST', `/bookings/${bookingId}/confirm-payment`, { token: client });
    await ctx.jobs.run('dispatch', 'start');
  });

  it("un client ne peut pas lire l'intervention d'un autre client", async () => {
    const other = await tokenOf(ctx, PHONES.clientB);
    const r = await call(ctx, 'GET', `/bookings/${bookingId}`, { token: other });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('booking_forbidden');
    expect((await call(ctx, 'POST', `/bookings/${bookingId}/cancel`, { token: other, body: {} })).status).toBe(403);
    expect((await call(ctx, 'GET', `/bookings/${bookingId}`)).status).toBe(401);
  });

  it("l'artisan sollicité ne voit pas l'adresse exacte avant acceptation", async () => {
    const artisan = await tokenOf(ctx, PHONES.artisan1);
    const before = await call(ctx, 'GET', `/bookings/${bookingId}`, { token: artisan });
    expect(before.status).toBe(200);
    expect(before.body.address).toMatchObject({ line1: null, lat: null, lng: null, doorCode: null, floor: null, postalCode: '13001', city: 'Marseille' });
    expect(before.body.address.approxLat).toBeCloseTo(43.3, 1);
    expect(before.body.completionCode).toBeNull();
    const offers = await call(ctx, 'GET', '/artisan/offers', { token: artisan });
    const accept = await call(ctx, 'POST', `/artisan/offers/${offers.body[0].id}/accept`, { token: artisan });
    expect(accept.status).toBe(200);
    expect(accept.body.address.line1).toBe('12 rue Paradis');
    expect(accept.body.address.doorCode).toBe('A1234');
    expect(accept.body.completionCode).toBeNull();
    // Un artisan non sollicité n'y a pas accès
    const pending = await tokenOf(ctx, PHONES.pending);
    expect((await call(ctx, 'GET', `/bookings/${bookingId}`, { token: pending })).status).toBe(403);
  });

  it('le support lit les interventions mais ne modifie ni le catalogue ni les artisans', async () => {
    const support = await tokenOf(ctx, PHONES.support);
    expect((await call(ctx, 'GET', '/admin/bookings', { token: support })).status).toBe(200);
    const detail = await call(ctx, 'GET', `/admin/bookings/${bookingId}`, { token: support });
    expect(detail.status).toBe(200);
    expect(detail.body.dispatchOffers.length).toBe(3);
    expect(detail.body.clientPhone).toBe(PHONES.clientA);
    expect((await call(ctx, 'GET', '/admin/disputes', { token: support })).status).toBe(200);
    expect((await call(ctx, 'GET', '/admin/users', { token: support })).status).toBe(200);
    expect((await call(ctx, 'GET', '/admin/artisans', { token: support })).status).toBe(200);

    const svc = { domain: 'plomberie', slug: 'nouvelle', name: 'Nouvelle prestation', kind: 'repair', urgentEligible: false, referencePriceCents: 5000, defaultDurationMinutes: 60 };
    expect((await call(ctx, 'POST', '/admin/services', { token: support, body: svc })).status).toBe(403);
    expect((await call(ctx, 'PATCH', `/admin/services/${fx.services.fuite}`, { token: support, body: { referencePriceCents: 1 } })).status).toBe(403);
    expect((await call(ctx, 'POST', '/admin/zones', { token: support, body: { name: 'Lyon', centerLat: 45.7, centerLng: 4.8, radiusKm: 20, commissionRate: 0.15 } })).status).toBe(403);
    expect((await call(ctx, 'POST', `/admin/artisans/${fx.artisans.pending}/approve`, { token: support })).status).toBe(403);
    expect((await call(ctx, 'GET', '/admin/metrics', { token: support })).status).toBe(403);
    expect((await call(ctx, 'GET', '/admin/exports/dac7?year=2026', { token: support })).status).toBe(403);

    const admin = await tokenOf(ctx, PHONES.admin);
    const created = await call(ctx, 'POST', '/admin/services', { token: admin, body: svc });
    expect(created.status).toBe(201);
    const m = await call(ctx, 'GET', '/admin/metrics', { token: admin });
    expect(m.status).toBe(200);
    expect(m.body.totals.bookings).toBe(1);
    for (const k of ['urgentTakeRate', 'urgentFunnelConversion', 'codeClosureRate', 'disputeRate', 'clientRecurrence']) {
      if (m.body[k] !== null) expect(m.body[k]).toBeLessThanOrEqual(1);
    }
  });

  it('un client ne peut pas accéder au back-office ni aux routes artisan', async () => {
    const client = await tokenOf(ctx, PHONES.clientB);
    expect((await call(ctx, 'GET', '/admin/bookings', { token: client })).status).toBe(403);
    const r = await call(ctx, 'GET', '/artisan/offers', { token: client });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('artisan_profile_required');
    const pending = await tokenOf(ctx, PHONES.pending);
    const p = await call(ctx, 'GET', '/artisan/offers', { token: pending });
    expect(p.status).toBe(403);
    expect(p.body.code).toBe('artisan_not_approved');
  });

  it('les visiteurs parcourent le catalogue et estiment le prix sans compte', async () => {
    const domains = await call(ctx, 'GET', '/domains');
    expect(domains.status).toBe(200);
    expect(domains.body[0].services.length).toBeGreaterThan(0);
    const search = await call(ctx, 'GET', `/artisans?domain=plomberie&lat=43.2951&lng=5.3772&sort=distance`);
    expect(search.status).toBe(200);
    expect(search.body.items.length).toBe(3);
    expect(search.body.items[0].distanceKm).toBeLessThanOrEqual(search.body.items[1].distanceKm);
    const profile = await call(ctx, 'GET', `/artisans/${fx.artisans.a1}`);
    expect(profile.status).toBe(200);
    expect(JSON.stringify(profile.body)).not.toContain(PHONES.artisan1);
    expect((await call(ctx, 'GET', `/artisans/${fx.artisans.pending}`)).status).toBe(404);
    const est = await call(ctx, 'POST', '/estimate', { body: { domain: 'plomberie', serviceId: fx.services.fuite, urgent: true, lat: 43.2951, lng: 5.3772 } });
    expect(est.status).toBe(200);
    expect(est.body.price.totalCents).toBe(9000 + 2500 + 3000);
    expect(est.body.inZone).toBe(true);
  });
});
