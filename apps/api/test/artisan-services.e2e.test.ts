import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from '@depano/db';
import * as s from '@depano/db';
import { call, createTestApp, PHONES, resetState, seedFixtures, tokenOf, type Fixtures, type TestContext } from './helpers';
import { addDays, parisDate } from '../src/common/time';

const INLINE = { line1: '5 rue de Rome', postalCode: '13001', city: 'Marseille', lat: 43.296, lng: 5.379 };
const MITIGEUR = { domain: 'plomberie', name: 'Remplacement de mitigeur thermostatique', kind: 'repair', priceCents: 14000, durationMinutes: 90 };

describe('Tarifs artisan : motifs personnels et prestations désactivées', () => {
  let ctx: TestContext;
  let fx: Fixtures;
  let clientA: string;
  let artisan: string;
  let artisan2: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => {
    await resetState(ctx);
    fx = await seedFixtures(ctx.db);
    clientA = await tokenOf(ctx, PHONES.clientA);
    artisan = await tokenOf(ctx, PHONES.artisan1);
    artisan2 = await tokenOf(ctx, PHONES.artisan2);
  });

  async function slotIn(daysAhead: number, serviceId: string, artisanId = fx.artisans.a1) {
    const from = addDays(parisDate(new Date()), daysAhead);
    const r = await call(ctx, 'GET', `/artisans/${artisanId}/slots?serviceId=${serviceId}&from=${from}&days=1`);
    expect(r.status).toBe(200);
    return r.body[0].slots[0] as string;
  }

  const book = async (serviceId: string, artisanId = fx.artisans.a1, extra: Record<string, unknown> = {}) =>
    call(ctx, 'POST', '/bookings', {
      token: clientA,
      body: { kind: 'scheduled', domain: 'plomberie', serviceId, artisanId, scheduledAt: await slotIn(2, serviceId, artisanId), address: INLINE, problemReason: 'Mitigeur', ...extra },
    });

  async function addCustom(body: Record<string, unknown> = MITIGEUR, token = artisan) {
    const r = await call(ctx, 'POST', '/artisan/services/custom', { token, body });
    expect(r.status).toBe(201);
    const svc = r.body.services.find((x: any) => x.name === body.name);
    expect(svc).toBeTruthy();
    return svc.serviceId as string;
  }

  it('motif personnel : créé actif, visible sur le profil public de son auteur seulement, hors catalogue', async () => {
    const created = await call(ctx, 'POST', '/artisan/services/custom', { token: artisan, body: MITIGEUR });
    expect(created.status).toBe(201);
    const own = created.body.services.find((x: any) => x.custom);
    expect(own).toMatchObject({ name: MITIGEUR.name, domain: 'plomberie', kind: 'repair', priceCents: 14000, durationMinutes: 90, custom: true, active: true });
    expect(created.body.services.filter((x: any) => !x.custom).every((x: any) => x.active === true && x.kind === 'repair')).toBe(true);

    const pub = (await call(ctx, 'GET', `/artisans/${fx.artisans.a1}`)).body;
    expect(pub.services.find((x: any) => x.serviceId === own.serviceId)).toMatchObject({ custom: true, kind: 'repair', priceCents: 14000 });
    expect(pub.services.find((x: any) => x.serviceId === fx.services.fuite)).toMatchObject({ custom: false });
    expect((await call(ctx, 'GET', `/artisans/${fx.artisans.a2}`)).body.services.map((x: any) => x.serviceId)).not.toContain(own.serviceId);

    // Catalogue DEPANO (client et back-office) : jamais les motifs personnels.
    const domains = (await call(ctx, 'GET', '/domains')).body;
    expect(domains.flatMap((d: any) => d.services.map((x: any) => x.id))).not.toContain(own.serviceId);
    const admin = await tokenOf(ctx, PHONES.admin);
    expect((await call(ctx, 'GET', '/admin/services', { token: admin })).body.map((x: any) => x.id)).not.toContain(own.serviceId);
    expect((await call(ctx, 'PATCH', `/admin/services/${own.serviceId}`, { token: admin, body: { referencePriceCents: 1 } })).status).toBe(404);

    // Réservable en RDV chez son auteur, au prix de l'artisan et pour sa durée.
    const ok = await book(own.serviceId);
    expect(ok.status).toBe(201);
    expect(ok.body.booking.price.baseCents).toBe(14000);
    expect(new Date(ok.body.booking.endsAt).getTime() - new Date(ok.body.booking.scheduledAt).getTime()).toBe(90 * 60_000);
    // … mais ni chez un autre artisan, ni en urgence.
    const other = await book(own.serviceId, fx.artisans.a2);
    expect(other.status).toBe(400);
    expect(other.body.code).toBe('invalid_service');
    const urgent = await call(ctx, 'POST', '/bookings', {
      token: clientA,
      body: { kind: 'urgent', domain: 'plomberie', serviceId: own.serviceId, addressId: fx.addressA, problemReason: 'Mitigeur', waivesWithdrawal: true },
    });
    expect(urgent.status).toBe(400);
  });

  it('motif personnel : contrôles (rôle, métier, doublon, plafond)', async () => {
    expect((await call(ctx, 'POST', '/artisan/services/custom', { token: clientA, body: MITIGEUR })).status).toBe(403);
    const wrongDomain = await call(ctx, 'POST', '/artisan/services/custom', { token: artisan, body: { ...MITIGEUR, domain: 'electricite' } });
    expect(wrongDomain.status).toBe(400);
    expect(wrongDomain.body.code).toBe('invalid_domain');
    expect((await call(ctx, 'POST', '/artisan/services/custom', { token: artisan, body: { ...MITIGEUR, priceCents: 0 } })).status).toBe(400);

    await addCustom();
    const dup = await call(ctx, 'POST', '/artisan/services/custom', { token: artisan, body: { ...MITIGEUR, name: MITIGEUR.name.toUpperCase() } });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('custom_service_exists');

    await ctx.db.insert(s.services).values(
      Array.from({ length: 29 }, (_, i) => ({
        domain: 'plomberie' as const,
        slug: `custom-test-${i}`,
        name: `Motif ${i}`,
        referencePriceCents: 5000,
        urgentEligible: false,
        ownerArtisanId: fx.artisans.a1,
      })),
    );
    const full = await call(ctx, 'POST', '/artisan/services/custom', { token: artisan, body: { ...MITIGEUR, name: 'Un motif de trop' } });
    expect(full.status).toBe(409);
    expect(full.body.code).toBe('custom_services_limit');
  });

  it('PUT /artisan/services : conserve les motifs personnels absents, refuse ceux d’un autre artisan', async () => {
    const own = await addCustom();
    const put = await call(ctx, 'PUT', '/artisan/services', { token: artisan, body: { services: [{ serviceId: fx.services.fuite, priceCents: 9900, durationMinutes: 60 }] } });
    expect(put.status).toBe(200);
    // Catalogue absent du corps : retiré ; motif personnel absent : conservé.
    expect(put.body.services.map((x: any) => x.serviceId).sort()).toEqual([fx.services.fuite, own].sort());

    const foreign = await call(ctx, 'PUT', '/artisan/services', { token: artisan2, body: { services: [{ serviceId: own, priceCents: 1000, durationMinutes: 60 }] } });
    expect(foreign.status).toBe(400);
    expect(foreign.body.code).toBe('invalid_service');
  });

  it('prestation désactivée : prix conservé, invisible des clients, refusée à la réservation', async () => {
    const own = await addCustom();
    const put = await call(ctx, 'PUT', '/artisan/services', {
      token: artisan,
      body: {
        services: [
          { serviceId: fx.services.fuite, priceCents: 9000, durationMinutes: 60 },
          { serviceId: fx.services.debouchage, priceCents: 8500, durationMinutes: 60 },
          { serviceId: fx.services.robinet, priceCents: 7000, durationMinutes: 45, active: false },
          { serviceId: own, priceCents: 15000, durationMinutes: 90, active: false },
        ],
      },
    });
    expect(put.status).toBe(200);
    expect(put.body.services).toHaveLength(4);
    expect(put.body.services.find((x: any) => x.serviceId === fx.services.robinet)).toMatchObject({ active: false, priceCents: 7000, durationMinutes: 45 });
    expect(put.body.services.find((x: any) => x.serviceId === own)).toMatchObject({ active: false, priceCents: 15000, custom: true });
    expect(put.body.checklist.services).toBe(true);

    const pub = (await call(ctx, 'GET', `/artisans/${fx.artisans.a1}`)).body;
    expect(pub.services.map((x: any) => x.serviceId).sort()).toEqual([fx.services.fuite, fx.services.debouchage].sort());
    // « À partir de » : le moins cher des motifs actifs (7000 désactivé ⇒ 8500).
    expect(pub.fromPriceCents).toBe(8500);
    const search = (await call(ctx, 'GET', '/artisans?domain=plomberie&limit=50')).body.items;
    expect(search.find((c: any) => c.id === fx.artisans.a1).fromPriceCents).toBe(8500);
    expect(search.find((c: any) => c.id === fx.artisans.a2).fromPriceCents).toBe(7500);

    const refused = await book(fx.services.robinet);
    expect(refused.status).toBe(400);
    expect(refused.body.code).toBe('service_not_offered');
    expect((await book(own)).status).toBe(400);

    // Réactivation sans ressaisir le prix.
    const again = await call(ctx, 'PUT', '/artisan/services', {
      token: artisan,
      body: { services: put.body.services.map((x: any) => ({ serviceId: x.serviceId, priceCents: x.priceCents, durationMinutes: x.durationMinutes, active: true })) },
    });
    expect(again.body.services.every((x: any) => x.active)).toBe(true);
    expect((await book(fx.services.robinet)).status).toBe(201);
  });

  it('suppression d’un motif personnel : réservée à son auteur, définitive, historique conservé', async () => {
    const own = await addCustom();
    const used = await addCustom({ ...MITIGEUR, name: 'Pose de réducteur de pression' });

    // Motif d'un autre artisan ou service du catalogue : 404.
    expect((await call(ctx, 'DELETE', `/artisan/services/custom/${own}`, { token: artisan2 })).status).toBe(404);
    expect((await call(ctx, 'DELETE', `/artisan/services/custom/${fx.services.fuite}`, { token: artisan })).status).toBe(404);
    expect((await call(ctx, 'DELETE', `/artisan/services/custom/${own}`, { token: clientA })).status).toBe(403);

    const del = await call(ctx, 'DELETE', `/artisan/services/custom/${own}`, { token: artisan });
    expect(del.status).toBe(200);
    expect(del.body.services.map((x: any) => x.serviceId)).not.toContain(own);
    expect(await ctx.db.select().from(s.services).where(eq(s.services.id, own))).toHaveLength(0);
    expect((await call(ctx, 'DELETE', `/artisan/services/custom/${own}`, { token: artisan })).status).toBe(404);

    // Référencé par une intervention : désactivé (factures, historique) mais retiré de l'offre.
    const booked = await book(used);
    expect(booked.status).toBe(201);
    const del2 = await call(ctx, 'DELETE', `/artisan/services/custom/${used}`, { token: artisan });
    expect(del2.status).toBe(200);
    expect(del2.body.services.map((x: any) => x.serviceId)).not.toContain(used);
    const [row] = await ctx.db.select().from(s.services).where(eq(s.services.id, used));
    expect(row).toMatchObject({ active: false, ownerArtisanId: fx.artisans.a1 });
    expect((await call(ctx, 'GET', `/bookings/${booked.body.booking.id}`, { token: clientA })).status).toBe(200);
    expect((await call(ctx, 'GET', `/artisans/${fx.artisans.a1}`)).body.services.map((x: any) => x.serviceId)).not.toContain(used);
    expect((await call(ctx, 'DELETE', `/artisan/services/custom/${used}`, { token: artisan })).status).toBe(404);
  });
});
