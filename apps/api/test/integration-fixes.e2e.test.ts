import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from '@depano/db';
import * as s from '@depano/db';
import { PAYMENT_PROVIDER } from '../src/infra/tokens';
import type { FakePaymentProvider } from '../src/providers/fake-payment.provider';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { call, createTestApp, PHONES, resetState, seedFixtures, tokenOf, CLIENT_POINT, type Fixtures, type TestContext } from './helpers';
import { urgentAccepted, urgentSearching } from './flows';

describe('Contrat HTTP : CORS, corps vides, offres, cartes, préférences, push, vocaux', () => {
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

  it('CORS : pré-vol autorisé pour PUT / PATCH / DELETE avec Authorization', async () => {
    const r = await ctx.app.inject({
      method: 'OPTIONS',
      url: '/v1/me/notification-preferences',
      headers: { origin: 'http://localhost:8081', 'access-control-request-method': 'PUT', 'access-control-request-headers': 'authorization,content-type' },
    });
    expect(r.statusCode).toBe(204);
    expect(r.headers['access-control-allow-origin']).toBe('http://localhost:8081');
    const methods = String(r.headers['access-control-allow-methods']);
    for (const m of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) expect(methods).toContain(m);
    expect(String(r.headers['access-control-allow-headers']).toLowerCase()).toContain('authorization');
  });

  it('accepte un POST JSON au corps vide (traité comme {})', async () => {
    const token = await tokenOf(ctx, PHONES.clientA);
    const r = await ctx.app.inject({ method: 'POST', url: '/v1/notifications/read-all', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
    expect(r.statusCode).toBe(204);
    const bad = await ctx.app.inject({ method: 'POST', url: '/v1/notifications/read-all', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: '{oops' });
    expect(bad.statusCode).toBe(400);
  });

  it('GET /artisan/offers/:id : propre offre uniquement, tout statut', async () => {
    const { id } = await urgentSearching(ctx, fx);
    const t1 = await tokenOf(ctx, PHONES.artisan1);
    const t2 = await tokenOf(ctx, PHONES.artisan2);
    const [o1] = (await call(ctx, 'GET', '/artisan/offers', { token: t1 })).body;
    const [o2] = (await call(ctx, 'GET', '/artisan/offers', { token: t2 })).body;
    const one = await call(ctx, 'GET', `/artisan/offers/${o1.id}`, { token: t1 });
    expect(one.status).toBe(200);
    expect(one.body).toMatchObject({ id: o1.id, bookingId: id, status: 'pending', city: 'Marseille' });
    expect((await call(ctx, 'GET', `/artisan/offers/${o1.id}`, { token: t2 })).status).toBe(403);
    expect((await call(ctx, 'GET', '/artisan/offers/00000000-0000-4000-8000-000000000000', { token: t1 })).status).toBe(404);
    expect((await call(ctx, 'POST', `/artisan/offers/${o1.id}/accept`, { token: t1 })).status).toBe(200);
    expect((await call(ctx, 'GET', `/artisan/offers/${o1.id}`, { token: t1 })).body.status).toBe('accepted');
    expect((await call(ctx, 'GET', `/artisan/offers/${o2.id}`, { token: t2 })).body.status).toBe('taken');
  });

  it('cartes artisan : position de base approchée (2 décimales)', async () => {
    const r = await call(ctx, 'GET', `/artisans?lat=${CLIENT_POINT.lat}&lng=${CLIENT_POINT.lng}&radiusKm=20`);
    expect(r.status).toBe(200);
    const a1 = r.body.items.find((a: any) => a.id === fx.artisans.a1);
    expect(a1).toMatchObject({ approxLat: 43.3, approxLng: 5.38 });
    const pub = await call(ctx, 'GET', `/artisans/${fx.artisans.a2}`);
    expect(pub.body).toMatchObject({ approxLat: 43.3, approxLng: 5.38 });
  });

  it('préférences de notifications : lecture, mise à jour partielle, push filtré (in-app conservé)', async () => {
    const token = await tokenOf(ctx, PHONES.clientA);
    expect((await call(ctx, 'GET', '/me/notification-preferences', { token })).body).toEqual({ bookingUpdates: true, messages: true, reminders: true, marketing: false });
    const put = await call(ctx, 'PUT', '/me/notification-preferences', { token, body: { messages: false } });
    expect(put.status).toBe(200);
    expect(put.body).toEqual({ bookingUpdates: true, messages: false, reminders: true, marketing: false });
    expect((await call(ctx, 'PUT', '/me/notification-preferences', { token, body: { marketing: true } })).body).toMatchObject({ messages: false, marketing: true });
    expect((await call(ctx, 'PUT', '/me/notification-preferences', { token, body: { unknown: true } })).status).toBe(400);

    expect((await call(ctx, 'POST', '/me/push-tokens', { token, body: { token: 'ExponentPushToken[client-A-123]', platform: 'ios' } })).status).toBe(204);
    const notifications = ctx.app.get(NotificationsService);
    const userId = fx.users.clientA;
    expect(await notifications.deliverPush({ userId, title: 'Karim', body: 'Bonjour', data: { type: 'message' } })).toEqual({ sent: 0, skipped: 'preference' });
    expect(await notifications.deliverPush({ userId, title: 'Artisan trouvé', body: 'Karim arrive', data: { type: 'booking_accepted' } })).toEqual({ sent: 1 });
    // Sans catégorie (compte, sécurité) : toujours envoyée
    expect(await notifications.deliverPush({ userId, title: 'Info', body: 'x' })).toEqual({ sent: 1 });
    // La notification in-app est enregistrée même si le push est coupé
    await notifications.notify(userId, { type: 'message', title: 'Nouveau message', body: 'Bonjour' });
    expect((await call(ctx, 'GET', '/notifications', { token })).body.items.some((n: any) => n.title === 'Nouveau message')).toBe(true);
  });

  it('désinscription du jeton push (déconnexion) : seulement le sien', async () => {
    const a = await tokenOf(ctx, PHONES.clientA);
    const b = await tokenOf(ctx, PHONES.clientB);
    const tokA = 'ExponentPushToken[aaaa-1111]';
    const tokB = 'ExponentPushToken[bbbb-2222]';
    await call(ctx, 'POST', '/me/push-tokens', { token: a, body: { token: tokA, platform: 'ios' } });
    await call(ctx, 'POST', '/me/push-tokens', { token: b, body: { token: tokB, platform: 'android' } });
    // B ne peut pas retirer le jeton de A
    expect((await call(ctx, 'DELETE', `/me/push-tokens/${encodeURIComponent(tokA)}`, { token: b })).status).toBe(204);
    expect(await ctx.db.select().from(s.pushTokens).where(eq(s.pushTokens.token, tokA))).toHaveLength(1);
    expect((await call(ctx, 'DELETE', `/me/push-tokens/${encodeURIComponent(tokA)}`, { token: a })).status).toBe(204);
    expect(await ctx.db.select().from(s.pushTokens).where(eq(s.pushTokens.token, tokA))).toHaveLength(0);
    expect(await ctx.db.select().from(s.pushTokens).where(eq(s.pushTokens.token, tokB))).toHaveLength(1);
  });

  it('message vocal : durée enregistrée et renvoyée', async () => {
    const { id, client } = await urgentAccepted(ctx, fx);
    const detail = (await call(ctx, 'GET', `/bookings/${id}`, { token: client })).body;
    const [file] = await ctx.db
      .insert(s.files)
      .values({ ownerId: fx.users.clientA, purpose: 'chat', storageKey: `chat/test-${Date.now()}.m4a`, contentType: 'audio/m4a', sizeBytes: 1200, uploadedAt: new Date() })
      .returning();
    const sent = await call(ctx, 'POST', `/conversations/${detail.conversationId}/messages`, {
      token: client,
      body: { clientId: 'voice-00000001', kind: 'voice', fileId: file!.id, durationMs: 7250 },
    });
    expect(sent.status).toBe(201);
    expect(sent.body).toMatchObject({ kind: 'voice', durationMs: 7250 });
    const list = await call(ctx, 'GET', `/conversations/${detail.conversationId}/messages`, { token: client });
    expect(list.body.items.find((m: any) => m.id === sent.body.id).durationMs).toBe(7250);
    const text = await call(ctx, 'POST', `/conversations/${detail.conversationId}/messages`, { token: client, body: { clientId: 'text-00000001', body: 'Salut', durationMs: 99 } });
    expect(text.body.durationMs).toBeNull();
  });

  it('complément de devis refusé par la banque : 402 explicite, montant autorisé inchangé', async () => {
    const { id, client, artisan } = await urgentAccepted(ctx, fx);
    for (const to of ['en_route', 'arrived']) await call(ctx, 'POST', `/bookings/${id}/transition`, { token: artisan, body: { to } });
    await call(ctx, 'POST', `/bookings/${id}/quote`, { token: artisan, body: { lines: [{ kind: 'labor', label: 'Remplacement', quantity: 1, unitPriceCents: 25000 }] } });
    const answered = await call(ctx, 'POST', `/bookings/${id}/quote/answer`, { token: client, body: { accept: true } });
    expect(answered.body.payment.amountCents).toBe(25000 - 14500);
    ctx.app.get<FakePaymentProvider>(PAYMENT_PROVIDER).intentOverrides.set(answered.body.payment.paymentIntentId, 'failed');
    const r = await call(ctx, 'POST', `/bookings/${id}/confirm-payment`, { token: client });
    expect(r.status).toBe(402);
    expect(r.body.code).toBe('supplement_failed');
    expect((await call(ctx, 'GET', `/bookings/${id}`, { token: client })).body.authorizedCents).toBe(14500);
  });
});
