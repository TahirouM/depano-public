import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from '@depano/db';
import * as s from '@depano/db';
import { StorageService } from '../src/infra/storage';
import { RedisConnection } from '../src/infra/redis';
import { call, createTestApp, login, PHONES, resetState, seedFixtures, tokenOf, type Fixtures, type TestContext } from './helpers';

describe('Compte, RGPD, onboarding artisan, fichiers, webhooks', () => {
  let ctx: TestContext;
  let fx: Fixtures;
  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.app.get(StorageService).ensureBucket();
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => {
    await resetState(ctx);
    fx = await seedFixtures(ctx.db);
  });

  async function upload(token: string, purpose: string, contentType = 'application/pdf') {
    const body = Buffer.from('%PDF-1.4 test');
    const u = await call(ctx, 'POST', '/files/upload-url', { token, body: { purpose, contentType, sizeBytes: body.length } });
    expect(u.status).toBe(200);
    const put = await fetch(u.body.uploadUrl, { method: 'PUT', headers: u.body.headers, body });
    expect(put.ok).toBe(true);
    const c = await call(ctx, 'POST', `/files/${u.body.fileId}/complete`, { token });
    expect(c.status).toBe(200);
    return u.body.fileId as string;
  }

  it('adresses, favoris, badges, export et suppression du compte', async () => {
    const t = await tokenOf(ctx, PHONES.clientB);
    const a1 = await call(ctx, 'POST', '/me/addresses', { token: t, body: { line1: '1 La Canebière', postalCode: '13001', city: 'Marseille', lat: 43.297, lng: 5.38 } });
    expect(a1.status).toBe(201);
    expect(a1.body.isDefault).toBe(true);
    const a2 = await call(ctx, 'POST', '/me/addresses', { token: t, body: { label: 'Travail', line1: '2 quai du Port', postalCode: '13002', city: 'Marseille', lat: 43.296, lng: 5.37, isDefault: true } });
    const list = (await call(ctx, 'GET', '/me/addresses', { token: t })).body;
    expect(list.find((x: any) => x.id === a2.body.id).isDefault).toBe(true);
    expect(list.find((x: any) => x.id === a1.body.id).isDefault).toBe(false);
    expect((await call(ctx, 'PATCH', `/me/addresses/${a1.body.id}`, { token: t, body: { doorCode: 'B12' } })).body.doorCode).toBe('B12');
    const other = await tokenOf(ctx, PHONES.clientA);
    expect((await call(ctx, 'DELETE', `/me/addresses/${a1.body.id}`, { token: other })).status).toBe(403);
    expect((await call(ctx, 'DELETE', `/me/addresses/${a1.body.id}`, { token: t })).status).toBe(204);
    expect((await call(ctx, 'GET', '/me/addresses', { token: t })).body).toHaveLength(1);

    expect((await call(ctx, 'PUT', `/me/favorites/${fx.artisans.a1}`, { token: t, body: {} })).status).toBe(204);
    const fav = (await call(ctx, 'GET', '/me/favorites', { token: t })).body;
    expect(fav[0]).toMatchObject({ id: fx.artisans.a1, urgentAvailable: true });
    expect(fav[0].nextSlotAt).toBeTruthy();
    expect((await call(ctx, 'POST', '/me/push-tokens', { token: t, body: { token: 'ExponentPushToken[abcdefghij]', platform: 'ios' } })).status).toBe(204);
    expect((await call(ctx, 'GET', '/me/badges', { token: t })).body).toEqual({ notifications: 0, messages: 0, activity: 0 });
    expect((await call(ctx, 'GET', '/me/payment-methods', { token: t })).body[0]).toMatchObject({ last4: '4242' });
    expect((await call(ctx, 'POST', '/me/payment-methods/setup-intent', { token: t })).body.provider).toBe('fake');

    const exp = await call(ctx, 'GET', '/me/export', { token: t });
    expect(exp.body.user.phone).toBe(PHONES.clientB);
    expect(exp.body.addresses).toHaveLength(2);

    expect((await call(ctx, 'DELETE', '/me', { token: t })).status).toBe(204);
    const [u] = await ctx.db.select().from(s.users).where(eq(s.users.id, fx.users.clientB));
    expect(u).toMatchObject({ phone: null, email: null, firstName: null, lastName: null });
    expect(u!.deletedAt).toBeTruthy();
    expect((await call(ctx, 'GET', '/me', { token: t })).status).toBe(401);
    // Le même numéro peut recréer un compte neuf
    await ctx.app.get(RedisConnection).redis.flushdb();
    const r = await call(ctx, 'POST', '/auth/otp/request', { body: { phone: PHONES.clientB } });
    const again = await call(ctx, 'POST', '/auth/otp/verify', { body: { phone: PHONES.clientB, code: r.body.devCode } });
    expect(again.body.isNewUser).toBe(true);
  });

  it('onboarding artisan : SIRET, profil, KYC, soumission, validation admin', async () => {
    const phone = '+33611112222';
    const { accessToken: t, user } = await login(ctx, phone);
    const siret = await call(ctx, 'POST', '/artisan/onboarding/siret', { token: t, body: { siret: '123 456 789 00012' } });
    expect(siret.status).toBe(200);
    expect(siret.body.siret).toBe('12345678900012');
    const me = (await call(ctx, 'GET', '/me', { token: t })).body;
    expect(me.roles).toContain('artisan');
    expect(me.artisan.status).toBe('draft');
    expect((await call(ctx, 'PUT', '/me/active-role', { token: t, body: { role: 'artisan' } })).body.activeRole).toBe('artisan');

    const p0 = (await call(ctx, 'GET', '/artisan/profile', { token: t })).body;
    expect(p0.checklist).toMatchObject({ siret: true, domains: false, services: false, identity: false });
    expect((await call(ctx, 'POST', '/artisan/submit', { token: t })).body.code).toBe('checklist_incomplete');

    await call(ctx, 'PATCH', '/artisan/profile', { token: t, body: { displayName: 'Paul P.', domains: ['plomberie'], baseLat: 43.3, baseLng: 5.38, baseCity: 'Marseille', radiusKm: 15 } });
    const svc = await call(ctx, 'PUT', '/artisan/services', { token: t, body: { services: [{ serviceId: fx.services.fuite, priceCents: 9500, durationMinutes: 60 }] } });
    expect(svc.body.services).toHaveLength(1);
    const rules = await call(ctx, 'PUT', '/artisan/availability/rules', { token: t, body: { rules: [{ weekday: 1, start: '08:00', end: '12:00' }] } });
    expect(rules.body.availabilityRules).toEqual([{ weekday: 1, start: '08:00', end: '12:00' }]);
    expect((await call(ctx, 'PUT', '/artisan/availability/rules', { token: t, body: { rules: [{ weekday: 1, start: '12:00', end: '08:00' }] } })).status).toBe(400);
    const exc = await call(ctx, 'POST', '/artisan/availability/exceptions', { token: t, body: { startsAt: '2030-01-01T08:00:00+01:00', endsAt: '2030-01-02T08:00:00+01:00', reason: 'Congés' } });
    expect(exc.status).toBe(201);

    const idFile = await upload(t, 'document');
    const insFile = await upload(t, 'document');
    // Un fichier d'un autre utilisateur est refusé
    const foreign = await upload(await tokenOf(ctx, PHONES.clientA), 'document');
    expect((await call(ctx, 'POST', '/artisan/documents', { token: t, body: { type: 'identity', fileId: foreign } })).status).toBe(400);
    const doc = await call(ctx, 'POST', '/artisan/documents', { token: t, body: { type: 'identity', fileId: idFile } });
    expect(doc.body).toMatchObject({ type: 'identity', status: 'pending' });
    expect(doc.body.fileUrl).toContain('X-Amz-Signature');
    await call(ctx, 'POST', '/artisan/documents', { token: t, body: { type: 'insurance_decennale', fileId: insFile, expiresAt: '2030-12-31' } });
    // Les documents ne sont pas accessibles aux autres utilisateurs
    expect((await call(ctx, 'GET', `/files/${idFile}/url`, { token: await tokenOf(ctx, PHONES.clientA) })).status).toBe(403);
    expect((await call(ctx, 'GET', `/files/${idFile}/url`, { token: await tokenOf(ctx, PHONES.admin) })).status).toBe(200);

    const link = await call(ctx, 'POST', '/artisan/payouts/onboarding-link', { token: t });
    expect(link.body.url).toContain('acct_fake_');
    const submitted = await call(ctx, 'POST', '/artisan/submit', { token: t });
    expect(submitted.status).toBe(200);
    expect(submitted.body.status).toBe('pending_review');
    expect((await call(ctx, 'PUT', '/artisan/urgent-availability', { token: t, body: { available: true } })).status).toBe(403);

    const admin = await tokenOf(ctx, PHONES.admin);
    const rows = (await call(ctx, 'GET', '/admin/artisans?status=pending_review', { token: admin })).body.items;
    const mine = rows.find((r: any) => r.userId === user.id);
    expect(mine).toBeTruthy();
    // Sans documents : refus de validation
    expect((await call(ctx, 'POST', `/admin/artisans/${fx.artisans.pending}/approve`, { token: admin })).body.code).toBe('documents_missing');
    const approved = await call(ctx, 'POST', `/admin/artisans/${mine.id}/approve`, { token: admin });
    expect(approved.body.status).toBe('approved');
    expect((await call(ctx, 'POST', `/admin/documents/${doc.body.id}/approve`, { token: admin })).body.status).toBe('approved');
    const audit = await ctx.db.select().from(s.auditLogs).where(eq(s.auditLogs.entityId, mine.id));
    expect(audit.map((a) => a.action)).toContain('artisan.approve');
    const notifs = (await call(ctx, 'GET', '/notifications', { token: t })).body.items;
    expect(notifs[0].type).toBe('artisan_approved');
    expect((await call(ctx, 'POST', `/notifications/${notifs[0].id}/read`, { token: t })).status).toBe(204);
    const urgent = await call(ctx, 'PUT', '/artisan/urgent-availability', { token: t, body: { available: true, lat: 43.3, lng: 5.38 } });
    expect(urgent.body.urgentAvailable).toBe(true);
    expect((await call(ctx, 'GET', '/artisan/dashboard', { token: t })).body).toMatchObject({ status: 'approved', urgentAvailable: true });
    expect((await call(ctx, 'GET', '/artisan/earnings', { token: t })).body.lifetimeCents).toBe(0);

    const suspended = await call(ctx, 'POST', `/admin/artisans/${mine.id}/suspend`, { token: admin, body: { reason: 'Fraude' } });
    expect(suspended.body.status).toBe('suspended');
    expect((await call(ctx, 'GET', '/artisan/offers', { token: t })).status).toBe(403);
    expect((await call(ctx, 'POST', `/admin/artisans/${mine.id}/reinstate`, { token: admin })).body.status).toBe('approved');
  });

  it('webhook Stripe idempotent', async () => {
    const event = { id: 'evt_test_1', type: 'account.updated', data: { object: { id: 'acct_fake_1', payouts_enabled: false } } };
    const r1 = await call(ctx, 'POST', '/webhooks/stripe', { body: event });
    expect(r1.body).toEqual({ received: true });
    const r2 = await call(ctx, 'POST', '/webhooks/stripe', { body: event });
    expect(r2.body).toEqual({ received: true, duplicate: true });
    const [a] = await ctx.db.select().from(s.artisanProfiles).where(eq(s.artisanProfiles.id, fx.artisans.a1));
    expect(a!.payoutsEnabled).toBe(false);
  });
});
