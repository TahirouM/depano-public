import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from '@depano/db';
import * as s from '@depano/db';
import { StorageService } from '../src/infra/storage';
import { PAYMENT_PROVIDER } from '../src/infra/tokens';
import type { FakePaymentProvider } from '../src/providers/fake-payment.provider';
import { call, createTestApp, PHONES, resetState, seedFixtures, tokenOf, type Fixtures, type TestContext } from './helpers';
import { ARTISAN_PHONE_BY_ID, urgentAwaitingCode, urgentSearching } from './flows';

describe('Parcours urgence de bout en bout (paiement factice)', () => {
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

  it('création → empreinte → dispatch → course à l’acceptation → devis → code → capture', async () => {
    const client = await tokenOf(ctx, PHONES.clientA);
    const created = await call(ctx, 'POST', '/bookings', {
      token: client,
      body: { kind: 'urgent', domain: 'plomberie', serviceId: fx.services.fuite, addressId: fx.addressA, problemReason: 'Fuite sous évier', waivesWithdrawal: true },
    });
    expect(created.status).toBe(201);
    const b0 = created.body.booking;
    const id = b0.id as string;
    expect(b0.status).toBe('pending_payment');
    expect(b0.reference).toMatch(/^DEP-[A-Z0-9]{6}$/);
    expect(b0.price).toMatchObject({ baseCents: 9000, travelFeeCents: 2500, urgentFeeCents: 3000, totalCents: 14500 });
    expect(created.body.payment).toMatchObject({ provider: 'fake', amountCents: 14500, setupIntentId: null });
    expect(created.body.payment.paymentIntentId).toMatch(/^pi_fake_/);

    // Sans renonciation expresse : refusé
    const noWaiver = await call(ctx, 'POST', '/bookings', { token: client, body: { kind: 'urgent', domain: 'plomberie', addressId: fx.addressA, problemReason: 'x' } });
    expect(noWaiver.status).toBe(400);

    const confirmed = await call(ctx, 'POST', `/bookings/${id}/confirm-payment`, { token: client });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.status).toBe('searching');
    expect(confirmed.body.authorizedCents).toBe(14500);
    expect(ctx.jobs.find('dispatch', 'start')).toHaveLength(1);

    // Vague 1 (5 km) : les 3 artisans proches
    await ctx.jobs.run('dispatch', 'start');
    const offersCreated = ctx.realtime.of('offer.created');
    expect(offersCreated).toHaveLength(3);
    expect(ctx.realtime.of('booking.dispatch')[0]!.payload).toMatchObject({ wave: 1, contacted: 3, radiusKm: 5 });
    expect(ctx.jobs.find('dispatch', 'wave-timeout')).toHaveLength(1);

    const t1 = await tokenOf(ctx, PHONES.artisan1);
    const t2 = await tokenOf(ctx, PHONES.artisan2);
    const t3 = await tokenOf(ctx, PHONES.artisan3);
    const o1 = (await call(ctx, 'GET', '/artisan/offers', { token: t1 })).body;
    const o2 = (await call(ctx, 'GET', '/artisan/offers', { token: t2 })).body;
    expect(o1).toHaveLength(1);
    expect(o1[0]).toMatchObject({ bookingId: id, status: 'pending', totalCents: 14500, estimatedEarningsCents: 14500 - 2175, city: 'Marseille' });

    // Course : deux artisans acceptent en même temps, un seul gagne
    const [r1, r2] = await Promise.all([
      call(ctx, 'POST', `/artisan/offers/${o1[0].id}/accept`, { token: t1 }),
      call(ctx, 'POST', `/artisan/offers/${o2[0].id}/accept`, { token: t2 }),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 409]);
    const loser = r1.status === 409 ? r1 : r2;
    expect(loser.body.code).toBe('offer_taken');
    const winnerRes = r1.status === 200 ? r1 : r2;
    expect(winnerRes.body.status).toBe('accepted');
    const winnerArtisanId = winnerRes.body.artisan.id as string;
    const winner = await tokenOf(ctx, ARTISAN_PHONE_BY_ID(fx)[winnerArtisanId]!);
    const offers = await ctx.db.select().from(s.dispatchOffers).where(eq(s.dispatchOffers.bookingId, id));
    expect(offers.filter((o) => o.status === 'accepted')).toHaveLength(1);
    expect(offers.filter((o) => o.status === 'taken')).toHaveLength(2);
    expect(ctx.realtime.of('offer.revoked').some((e) => e.payload.reason === 'taken')).toBe(true);
    expect((await call(ctx, 'GET', '/artisan/offers', { token: t3 })).body).toHaveLength(0);
    // Le minuteur de vague est retiré : la vague suivante ne part pas
    expect(ctx.jobs.find('dispatch', 'wave-timeout')).toHaveLength(0);

    // Conversation créée, code visible par le client seulement
    const cDetail = (await call(ctx, 'GET', `/bookings/${id}`, { token: client })).body;
    expect(cDetail.conversationId).toBeTruthy();
    expect(cDetail.completionCode).toMatch(/^\d{4}$/);
    expect(cDetail.allowedTransitions).toEqual(expect.arrayContaining(['cancelled_by_client', 'disputed']));
    expect(cDetail.cancellationIsFree).toBe(false);
    expect(cDetail.cancellationFeeCents).toBe(2500);
    const aDetail = (await call(ctx, 'GET', `/bookings/${id}`, { token: winner })).body;
    expect(aDetail.completionCode).toBeNull();
    expect(aDetail.allowedTransitions).toEqual(expect.arrayContaining(['en_route', 'cancelled_by_artisan']));
    const code = cDetail.completionCode as string;

    // Messagerie
    const msg = await call(ctx, 'POST', `/conversations/${cDetail.conversationId}/messages`, { token: client, body: { clientId: 'msg-00000001', body: 'Bonjour, code porte A1234' } });
    expect(msg.status).toBe(201);
    const dup = await call(ctx, 'POST', `/conversations/${cDetail.conversationId}/messages`, { token: client, body: { clientId: 'msg-00000001', body: 'Bonjour, code porte A1234' } });
    expect(dup.body.id).toBe(msg.body.id);
    const convs = await call(ctx, 'GET', '/conversations', { token: winner });
    expect(convs.body[0].unreadCount).toBe(1);
    expect((await call(ctx, 'GET', '/me/badges', { token: winner })).body.messages).toBe(1);

    // Déplacement + position
    expect((await call(ctx, 'POST', `/bookings/${id}/transition`, { token: client, body: { to: 'en_route' } })).status).toBe(409);
    expect((await call(ctx, 'POST', `/bookings/${id}/transition`, { token: winner, body: { to: 'en_route', lat: 43.3, lng: 5.39 } })).body.status).toBe('en_route');
    expect((await call(ctx, 'POST', `/bookings/${id}/location`, { token: winner, body: { lat: 43.298, lng: 5.385 } })).status).toBe(204);
    const loc = ctx.realtime.of('booking.location')[0]!;
    expect(loc.payload.etaMinutes).toBeGreaterThan(0);
    expect((await call(ctx, 'GET', `/bookings/${id}`, { token: client })).body.artisanLocation).toEqual({ lat: 43.298, lng: 5.385 });
    expect((await call(ctx, 'POST', `/bookings/${id}/transition`, { token: winner, body: { to: 'arrived' } })).body.status).toBe('arrived');
    expect((await call(ctx, 'POST', `/bookings/${id}/call`, { token: client })).body.phoneNumber).toMatch(/^\+339/);

    // Devis avec dépassement > 20 % : autorisation complémentaire
    const quote = await call(ctx, 'POST', `/bookings/${id}/quote`, {
      token: winner,
      body: { lines: [{ kind: 'labor', label: 'Main d’œuvre', quantity: 2, unitPriceCents: 6000 }, { kind: 'part', label: 'Siphon', quantity: 1, unitPriceCents: 8000 }] },
    });
    expect(quote.status).toBe(200);
    expect(quote.body.status).toBe('quote_pending');
    expect(quote.body.quote).toMatchObject({ totalCents: 20000, needsNewAuthorization: true, status: 'sent' });
    expect(ctx.jobs.find('bookings', 'quote-expire')).toHaveLength(1);
    const answered = await call(ctx, 'POST', `/bookings/${id}/quote/answer`, { token: client, body: { accept: true } });
    expect(answered.status).toBe(200);
    expect(answered.body.booking.status).toBe('in_progress');
    expect(answered.body.payment).toMatchObject({ provider: 'fake', amountCents: 5500 });
    // Le complément attend la validation du client (payment sheet) : pas encore compté.
    expect(answered.body.booking.authorizedCents).toBe(14500);
    const supRef = answered.body.payment.paymentIntentId as string;
    const fake = ctx.app.get<FakePaymentProvider>(PAYMENT_PROVIDER);
    fake.intentOverrides.set(supRef, 'requires_action');
    const notYet = await call(ctx, 'POST', `/bookings/${id}/confirm-payment`, { token: client });
    expect(notYet.status).toBe(402);
    expect(notYet.body.code).toBe('supplement_not_authorized');
    fake.intentOverrides.delete(supRef);
    // Après la payment sheet : POST confirm-payment confirme le complément (statut prestataire vérifié).
    const supConfirmed = await call(ctx, 'POST', `/bookings/${id}/confirm-payment`, { token: client });
    expect(supConfirmed.status).toBe(200);
    expect(supConfirmed.body.status).toBe('in_progress');
    expect(supConfirmed.body.authorizedCents).toBe(20000);
    // Idempotent
    expect((await call(ctx, 'POST', `/bookings/${id}/confirm-payment`, { token: client })).body.authorizedCents).toBe(20000);

    // Compte rendu → attente du code
    const report = await call(ctx, 'POST', `/bookings/${id}/report`, { token: winner, body: { feasible: true, notes: 'Siphon remplacé', materials: 'Siphon PVC' } });
    expect(report.body.status).toBe('awaiting_code');
    expect(report.body.report.notes).toBe('Siphon remplacé');
    expect(ctx.jobs.find('bookings', 'auto-capture')[0]!.opts.delayMs).toBe(24 * 3600 * 1000);

    // Mauvais code puis bon code
    const wrong = code === '0000' ? '1111' : '0000';
    const bad = await call(ctx, 'POST', `/bookings/${id}/complete`, { token: winner, body: { code: wrong } });
    expect(bad.status).toBe(400);
    expect(bad.body).toMatchObject({ code: 'code_invalid', details: { attemptsLeft: 2 } });
    expect((await call(ctx, 'POST', `/bookings/${id}/complete`, { token: client, body: { code } })).status).toBe(403);
    const done = await call(ctx, 'POST', `/bookings/${id}/complete`, { token: winner, body: { code } });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe('closed');
    expect(done.body.capturedCents).toBe(20000);
    expect(done.body.commissionCents).toBe(3000);
    const pays = await ctx.db.select().from(s.payments).where(eq(s.payments.bookingId, id));
    expect(pays.map((p) => [p.kind, p.status, p.capturedCents]).sort()).toEqual([
      ['authorization', 'captured', 14500],
      ['supplement', 'captured', 5500],
    ]);
    expect(pays.find((p) => p.kind === 'authorization')!.applicationFeeCents).toBe(3000);
    const [prof] = await ctx.db.select().from(s.artisanProfiles).where(eq(s.artisanProfiles.id, winnerArtisanId));
    expect(prof!.completedCount).toBe(1);
    expect(prof!.offersAccepted).toBe(1);

    // Factures (worker)
    const inv = (await ctx.jobs.run('invoices', 'generate')) as any;
    expect(inv.created).toHaveLength(2);
    const year = new Date().getFullYear();
    expect(inv.created[0]).toBe(`F-${year}-000001`);
    const myInvoices = await call(ctx, 'GET', '/me/invoices', { token: client });
    expect(myInvoices.body).toHaveLength(1);
    expect(myInvoices.body[0]).toMatchObject({ kind: 'service', totalCents: 20000 });
    expect(myInvoices.body[0].pdfUrl).toContain('invoices');

    // Avis : un seul, client uniquement
    expect((await call(ctx, 'GET', `/bookings/${id}`, { token: client })).body.canReview).toBe(true);
    expect((await call(ctx, 'POST', `/bookings/${id}/review`, { token: winner, body: { rating: 5 } })).status).toBe(403);
    const review = await call(ctx, 'POST', `/bookings/${id}/review`, { token: client, body: { rating: 4, tags: ['Ponctuel'], comment: 'Très bien' } });
    expect(review.status).toBe(201);
    expect((await call(ctx, 'POST', `/bookings/${id}/review`, { token: client, body: { rating: 5 } })).status).toBe(409);
    const reply = await call(ctx, 'POST', `/reviews/${review.body.id}/reply`, { token: winner, body: { body: 'Merci !' } });
    expect(reply.body.reply.body).toBe('Merci !');
    const [prof2] = await ctx.db.select().from(s.artisanProfiles).where(eq(s.artisanProfiles.id, winnerArtisanId));
    // Mise à jour incrémentale : l'historique (4,5 / 10 avis) est conservé.
    expect(prof2!.ratingCount).toBe(11);
    expect(prof2!.ratingAvg).toBeCloseTo((4.5 * 10 + 4) / 11, 4);

    // Journal complet
    const events = await ctx.db.select().from(s.bookingEvents).where(eq(s.bookingEvents.bookingId, id));
    expect(events.map((e) => e.toStatus)).toEqual(['pending_payment', 'searching', 'accepted', 'en_route', 'arrived', 'quote_pending', 'in_progress', 'awaiting_code', 'closed']);
    // Notification client « artisan trouvé »
    const notifs = await call(ctx, 'GET', '/notifications', { token: client });
    expect(notifs.body.items.some((n: any) => n.type === 'booking_accepted')).toBe(true);
  });

  it('3 codes erronés : blocage, audit et alerte support', async () => {
    const { id, client, artisan } = await urgentAwaitingCode(ctx, fx);
    const code = (await call(ctx, 'GET', `/bookings/${id}`, { token: client })).body.completionCode as string;
    const wrong = code === '0000' ? '1111' : '0000';
    expect((await call(ctx, 'POST', `/bookings/${id}/complete`, { token: artisan, body: { code: wrong } })).status).toBe(400);
    expect((await call(ctx, 'POST', `/bookings/${id}/complete`, { token: artisan, body: { code: wrong } })).body.details.attemptsLeft).toBe(1);
    const third = await call(ctx, 'POST', `/bookings/${id}/complete`, { token: artisan, body: { code: wrong } });
    expect(third.status).toBe(423);
    expect(third.body.code).toBe('code_locked');
    const right = await call(ctx, 'POST', `/bookings/${id}/complete`, { token: artisan, body: { code } });
    expect(right.status).toBe(423);
    const logs = await ctx.db.select().from(s.auditLogs).where(and(eq(s.auditLogs.entityId, id), eq(s.auditLogs.action, 'completion_code_locked')));
    expect(logs).toHaveLength(1);
    const supportNotifs = await ctx.db.select().from(s.notifications).where(eq(s.notifications.userId, fx.users.support));
    expect(supportNotifs.some((n) => n.title === 'Code de fin bloqué')).toBe(true);
    expect((await call(ctx, 'GET', `/bookings/${id}`, { token: client })).body.completionAttemptsLeft).toBe(0);

    // Sans code : capture automatique au bout de 24 h
    const auto = (await ctx.jobs.run('bookings', 'auto-capture')) as any;
    expect(auto.captured).toBe(15000); // complément hors session inclus
    expect((await call(ctx, 'GET', `/bookings/${id}`, { token: client })).body.status).toBe('closed');
  });

  it('devis refusé puis « déplacement seulement » : pas de commission', async () => {
    const { id, client } = await urgentSearching(ctx, fx);
    const t1 = await tokenOf(ctx, PHONES.artisan1);
    const offer = (await call(ctx, 'GET', '/artisan/offers', { token: t1 })).body[0];
    await call(ctx, 'POST', `/artisan/offers/${offer.id}/accept`, { token: t1 });
    await call(ctx, 'POST', `/bookings/${id}/transition`, { token: t1, body: { to: 'en_route' } });
    await call(ctx, 'POST', `/bookings/${id}/transition`, { token: t1, body: { to: 'arrived' } });
    await call(ctx, 'POST', `/bookings/${id}/quote`, { token: t1, body: { lines: [{ kind: 'labor', label: 'Travaux', quantity: 1, unitPriceCents: 16000 }] } });
    const refused = await call(ctx, 'POST', `/bookings/${id}/quote/answer`, { token: client, body: { accept: false } });
    expect(refused.body.booking.status).toBe('arrived');
    expect(refused.body.booking.quote.status).toBe('refused');
    const report = await call(ctx, 'POST', `/bookings/${id}/report`, { token: t1, body: { feasible: false, travelOnly: true } });
    expect(report.body.status).toBe('awaiting_code');
    const code = (await call(ctx, 'GET', `/bookings/${id}`, { token: client })).body.completionCode;
    const done = await call(ctx, 'POST', `/bookings/${id}/complete`, { token: t1, body: { code } });
    expect(done.body).toMatchObject({ status: 'closed', capturedCents: 2500, commissionCents: 0 });
  });

  it('devis expiré : retour à « arrivé » par le système', async () => {
    const { id, client } = await urgentSearching(ctx, fx);
    const t1 = await tokenOf(ctx, PHONES.artisan1);
    const offer = (await call(ctx, 'GET', '/artisan/offers', { token: t1 })).body[0];
    await call(ctx, 'POST', `/artisan/offers/${offer.id}/accept`, { token: t1 });
    await call(ctx, 'POST', `/bookings/${id}/transition`, { token: t1, body: { to: 'en_route' } });
    await call(ctx, 'POST', `/bookings/${id}/transition`, { token: t1, body: { to: 'arrived' } });
    await call(ctx, 'POST', `/bookings/${id}/quote`, { token: t1, body: { lines: [{ kind: 'labor', label: 'Travaux', quantity: 1, unitPriceCents: 10000 }] } });
    await ctx.jobs.run('bookings', 'quote-expire');
    const d = (await call(ctx, 'GET', `/bookings/${id}`, { token: client })).body;
    expect(d.status).toBe('arrived');
    expect(d.quote.status).toBe('expired');
    expect(d.events.at(-1)).toMatchObject({ actor: 'system', toStatus: 'arrived' });
  });
});
