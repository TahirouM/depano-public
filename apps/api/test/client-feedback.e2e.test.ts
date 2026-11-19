import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RULES } from '@depano/schemas';
import { and, eq } from '@depano/db';
import * as s from '@depano/db';
import { call, createTestApp, CLIENT_POINT, PHONES, resetState, seedFixtures, tokenOf, type Fixtures, type TestContext } from './helpers';
import { urgentAccepted } from './flows';
import { addDays, parisDate } from '../src/common/time';

const INLINE = { line1: '5 rue de Rome', postalCode: '13001', city: 'Marseille', lat: 43.296, lng: 5.379 };

describe('Retours clients : demandes de RDV, prix sur demande, parrainage, planning, promotion', () => {
  let ctx: TestContext;
  let fx: Fixtures;
  let clientA: string;
  let clientB: string;
  let artisan: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => {
    await resetState(ctx);
    fx = await seedFixtures(ctx.db);
    clientA = await tokenOf(ctx, PHONES.clientA);
    clientB = await tokenOf(ctx, PHONES.clientB);
    artisan = await tokenOf(ctx, PHONES.artisan1);
  });

  async function slotIn(daysAhead: number, index = 0) {
    const from = addDays(parisDate(new Date()), daysAhead);
    const r = await call(ctx, 'GET', `/artisans/${fx.artisans.a1}/slots?serviceId=${fx.services.fuite}&from=${from}&days=1`);
    return r.body[0].slots[index] as string;
  }

  async function book(token: string, scheduledAt: string, extra: Record<string, unknown> = {}) {
    const r = await call(ctx, 'POST', '/bookings', {
      token,
      body: { kind: 'scheduled', domain: 'plomberie', serviceId: fx.services.fuite, artisanId: fx.artisans.a1, scheduledAt, address: INLINE, problemReason: 'Robinet qui fuit', ...extra },
    });
    expect(r.status).toBe(201);
    return r.body;
  }

  /** RDV demandé (empreinte validée), en attente de l'artisan. */
  async function requested(token = clientA, daysAhead = 2) {
    const created = await book(token, await slotIn(daysAhead));
    const c = await call(ctx, 'POST', `/bookings/${created.booking.id}/confirm-payment`, { token });
    expect(c.body.status).toBe('requested');
    return created.booking.id as string;
  }

  const notificationsOf = (userId: string) => ctx.db.select().from(s.notifications).where(eq(s.notifications.userId, userId));

  it('demande de RDV : visible de l’artisan, chat fermé, acceptation ouvre la messagerie', async () => {
    const id = await requested();
    const detail = (await call(ctx, 'GET', `/bookings/${id}`, { token: clientA })).body;
    expect(detail).toMatchObject({ status: 'requested', artisanAccepted: false, conversationId: null });
    const expiresIn = new Date(detail.requestExpiresAt).getTime() - Date.now();
    expect(expiresIn).toBeGreaterThan(0);
    expect(expiresIn).toBeLessThanOrEqual(RULES.requestTtlHours * 3_600_000);
    expect(ctx.jobs.find('bookings', 'request-expire')).toHaveLength(1);
    expect((await notificationsOf(fx.users.artisan1)).map((n) => n.type)).toContain('booking_requested');

    // L'artisan voit la demande (adresse masquée) dans son tableau de bord, sa liste et son planning.
    const dash = (await call(ctx, 'GET', '/artisan/dashboard', { token: artisan })).body;
    expect(dash.pendingRequests.map((b: any) => b.id)).toEqual([id]);
    expect(dash.upcoming.map((b: any) => b.id)).not.toContain(id);
    expect((await call(ctx, 'GET', '/bookings?as=artisan&scope=active', { token: artisan })).body.items.map((b: any) => b.id)).toContain(id);
    expect((await call(ctx, 'GET', `/bookings/${id}`, { token: artisan })).body.address.line1).toBeNull();
    const from = new Date(Date.now() - 86_400_000).toISOString();
    const to = new Date(Date.now() + 10 * 86_400_000).toISOString();
    expect((await call(ctx, 'GET', `/artisan/planning?from=${from}&to=${to}`, { token: artisan })).body.bookings.map((b: any) => b.id)).toContain(id);
    expect((await call(ctx, 'GET', '/me/badges', { token: artisan })).body.activity).toBe(1);

    // Pas de conversation avant l'acceptation ; même une conversation existante reste fermée.
    expect((await call(ctx, 'GET', '/conversations', { token: clientA })).body).toHaveLength(0);
    const [conv] = await ctx.db.insert(s.conversations).values({ bookingId: id, clientUserId: fx.users.clientA, artisanUserId: fx.users.artisan1 }).returning();
    const early = await call(ctx, 'POST', `/conversations/${conv!.id}/messages`, { token: clientA, body: { clientId: 'early-0001', body: 'Bonjour ?' } });
    expect(early.status).toBe(403);
    expect(early.body.code).toBe('conversation_not_open');
    expect((await call(ctx, 'GET', '/conversations', { token: artisan })).body).toHaveLength(0);

    // Un autre artisan ne peut pas répondre ; l'artisan sollicité accepte.
    const other = await call(ctx, 'POST', `/bookings/${id}/respond`, { token: await tokenOf(ctx, PHONES.artisan2), body: { accept: true } });
    expect(other.status).toBe(403);
    const acc = await call(ctx, 'POST', `/bookings/${id}/respond`, { token: artisan, body: { accept: true, message: 'Je serai là, prévoyez un accès au compteur.' } });
    expect(acc.status).toBe(200);
    expect(acc.body).toMatchObject({ status: 'accepted', artisanAccepted: true });
    expect(acc.body.address.line1).toBe('5 rue de Rome');
    expect(ctx.jobs.find('bookings', 'request-expire')).toHaveLength(0);
    const cDetail = (await call(ctx, 'GET', `/bookings/${id}`, { token: clientA })).body;
    expect(cDetail.conversationId).toBe(conv!.id);
    expect(cDetail.completionCode).toMatch(/^\d{4}$/);
    const convs = (await call(ctx, 'GET', '/conversations', { token: clientA })).body;
    expect(convs).toHaveLength(1);
    expect(convs[0].lastMessage.body).toBe('Je serai là, prévoyez un accès au compteur.');
    const sent = await call(ctx, 'POST', `/conversations/${conv!.id}/messages`, { token: clientA, body: { clientId: 'after-0001', body: 'Parfait' } });
    expect(sent.status).toBe(201);
    expect((await notificationsOf(fx.users.clientA)).map((n) => n.title)).toContain('Rendez-vous confirmé');
    // Une seconde réponse est refusée.
    expect((await call(ctx, 'POST', `/bookings/${id}/respond`, { token: artisan, body: { accept: false } })).body.code).toBe('request_not_pending');
  });

  it('demande refusée : empreinte libérée, sans impact sur la fiabilité', async () => {
    const id = await requested();
    const r = await call(ctx, 'POST', `/bookings/${id}/respond`, { token: artisan, body: { accept: false, message: 'Pas disponible ce jour-là' } });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('cancelled_by_artisan');
    const pays = await ctx.db.select().from(s.payments).where(eq(s.payments.bookingId, id));
    expect(pays.every((p) => p.status === 'cancelled')).toBe(true);
    const [p] = await ctx.db.select().from(s.artisanProfiles).where(eq(s.artisanProfiles.id, fx.artisans.a1));
    expect(p!.reliabilityScore).toBe(100);
    expect((await call(ctx, 'GET', '/artisan/stats', { token: artisan })).body.cancellations30d).toBe(0);
    expect((await notificationsOf(fx.users.clientA)).map((n) => n.title)).toContain('Demande refusée');
    expect(ctx.jobs.find('bookings', 'request-expire')).toHaveLength(0);
  });

  it('demande sans réponse : expirée par le job, empreinte libérée, créneau rendu', async () => {
    const id = await requested();
    const at = (await ctx.db.select().from(s.bookings).where(eq(s.bookings.id, id)))[0]!.scheduledAt!.toISOString();
    expect((await ctx.jobs.run('bookings', 'request-expire', (d) => d.bookingId === id)) as any).toEqual({ expired: true });
    const d = (await call(ctx, 'GET', `/bookings/${id}`, { token: clientA })).body;
    expect(d.status).toBe('expired');
    const pays = await ctx.db.select().from(s.payments).where(eq(s.payments.bookingId, id));
    expect(pays.every((p) => p.status === 'cancelled')).toBe(true);
    expect((await notificationsOf(fx.users.clientA)).map((n) => n.title)).toContain('Demande expirée');
    const slots = (await call(ctx, 'GET', `/artisans/${fx.artisans.a1}/slots?serviceId=${fx.services.fuite}&from=${parisDate(new Date(at))}&days=1`)).body[0].slots;
    expect(slots).toContain(at);
  });

  it('prix sur demande (« Autre ») : demande → prix proposé → paiement → RDV confirmé', async () => {
    const at = await slotIn(3);
    const bad = await call(ctx, 'POST', '/bookings', {
      token: clientA,
      body: { kind: 'scheduled', domain: 'plomberie', artisanId: fx.artisans.a1, scheduledAt: at, address: INLINE, problemReason: 'Autre', priceOnRequest: true },
    });
    expect(bad.status).toBe(400);
    const created = await book(clientA, at, { serviceId: undefined, problemReason: 'Autre', problemDescription: 'Installer un adoucisseur', priceOnRequest: true });
    expect(created.payment).toBeNull();
    expect(created.booking).toMatchObject({ status: 'requested', priceOnRequest: true, conversationId: null });
    expect(created.booking.price.baseCents).toBe(0);
    const id = created.booking.id as string;
    expect(ctx.jobs.find('bookings', 'request-expire')).toHaveLength(1);
    expect((await notificationsOf(fx.users.artisan1)).map((n) => n.title)).toContain('Nouvelle demande de prix');
    // Le créneau est réservé.
    const slots = (await call(ctx, 'GET', `/artisans/${fx.artisans.a1}/slots?serviceId=${fx.services.fuite}&from=${parisDate(new Date(at))}&days=1`)).body[0].slots;
    expect(slots).not.toContain(at);

    const noPrice = await call(ctx, 'POST', `/bookings/${id}/respond`, { token: artisan, body: { accept: true } });
    expect(noPrice.status).toBe(400);
    expect(noPrice.body.code).toBe('price_required');
    const proposed = await call(ctx, 'POST', `/bookings/${id}/respond`, { token: artisan, body: { accept: true, priceCents: 18000, durationMinutes: 90 } });
    expect(proposed.status).toBe(200);
    expect(proposed.body).toMatchObject({ status: 'pending_payment', artisanAccepted: true, totalCents: 18000 + 2500 });
    expect(proposed.body.conversationId).toBeTruthy();
    const [row] = await ctx.db.select().from(s.bookings).where(eq(s.bookings.id, id));
    expect(row!.endsAt!.getTime() - row!.scheduledAt!.getTime()).toBe(90 * 60_000);
    expect((await notificationsOf(fx.users.clientA)).find((n) => n.type === 'price_proposed')?.link).toBe(`depano://intervention/${id}`);
    // La proposition attend le client : visible dans ses interventions en cours et côté artisan.
    expect((await call(ctx, 'GET', '/bookings?scope=active', { token: clientA })).body.items.map((b: any) => b.id)).toContain(id);
    expect((await call(ctx, 'GET', '/bookings?as=artisan', { token: artisan })).body.items.map((b: any) => b.id)).toContain(id);
    expect((await call(ctx, 'GET', `/bookings/${id}`, { token: clientA })).body.requestExpiresAt).toBeTruthy();

    // Seul le client paie ; la session est réutilisée tant que le montant ne change pas.
    expect((await call(ctx, 'POST', `/bookings/${id}/payment-session`, { token: artisan })).status).toBe(403);
    const s1 = await call(ctx, 'POST', `/bookings/${id}/payment-session`, { token: clientA });
    expect(s1.status).toBe(200);
    expect(s1.body.amountCents).toBe(20500);
    const s2 = await call(ctx, 'POST', `/bookings/${id}/payment-session`, { token: clientA });
    expect(s2.body.paymentIntentId).toBe(s1.body.paymentIntentId);
    const confirmed = await call(ctx, 'POST', `/bookings/${id}/confirm-payment`, { token: clientA });
    expect(confirmed.body.status).toBe('accepted');
    expect(confirmed.body.completionCode).toMatch(/^\d{4}$/);
    expect(confirmed.body.authorizedCents).toBe(20500);
    expect(ctx.jobs.find('bookings', 'request-expire')).toHaveLength(0);
    expect((await call(ctx, 'POST', `/bookings/${id}/payment-session`, { token: clientA })).status).toBe(409);
  });

  it('prix proposé jamais validé : proposition annulée à l’échéance', async () => {
    const created = await book(clientA, await slotIn(3), { problemReason: 'Autre', problemDescription: 'Pose douche italienne', priceOnRequest: true });
    const id = created.booking.id as string;
    await call(ctx, 'POST', `/bookings/${id}/respond`, { token: artisan, body: { accept: true, priceCents: 50000 } });
    await ctx.jobs.run('bookings', 'request-expire', (d) => d.bookingId === id);
    expect((await call(ctx, 'GET', `/bookings/${id}`, { token: clientA })).body.status).toBe('cancelled_by_client');
  });

  it('parrainage : code personnel, saisie unique, même montant pour les deux, réduction consommée puis rendue', async () => {
    const mine = (await call(ctx, 'GET', '/me/referral', { token: clientA })).body;
    expect(mine.code).toMatch(/^[A-Z0-9]{8}$/);
    expect(mine).toMatchObject({ canApplyCode: true, availableCents: 0, referredCount: 0 });
    expect((await call(ctx, 'POST', '/me/referral/apply', { token: clientA, body: { code: mine.code } })).body.code).toBe('own_referral_code');
    expect((await call(ctx, 'POST', '/me/referral/apply', { token: clientB, body: { code: 'INCONNU1' } })).status).toBe(404);

    const applied = await call(ctx, 'POST', '/me/referral/apply', { token: clientB, body: { code: mine.code.toLowerCase() } });
    expect(applied.status).toBe(200);
    const amount = applied.body.amountCents as number;
    expect(amount).toBeGreaterThanOrEqual(RULES.referral.minRewardCents);
    expect(amount).toBeLessThanOrEqual(RULES.referral.maxRewardCents);
    expect(amount % 100).toBe(0);
    expect(applied.body.referral).toMatchObject({ canApplyCode: false, availableCents: amount, nextDiscountCents: amount });
    const again = await call(ctx, 'POST', '/me/referral/apply', { token: clientB, body: { code: mine.code } });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('referral_already_applied');
    const referrer = (await call(ctx, 'GET', '/me/referral', { token: clientA })).body;
    expect(referrer).toMatchObject({ availableCents: amount, referredCount: 1 });
    expect(referrer.credits[0]).toMatchObject({ role: 'referrer', amountCents: amount, fromName: 'Bob' });
    expect((await notificationsOf(fx.users.clientA)).map((n) => n.type)).toContain('referral_reward');

    // Prochaine intervention du filleul : réduction déduite du total et de l'empreinte.
    const created = await book(clientB, await slotIn(3));
    const gross = 9000 + 2500;
    expect(created.booking.price).toMatchObject({ discountCents: amount, totalCents: gross - amount });
    expect(created.booking.totalCents).toBe(gross - amount);
    expect(created.payment.amountCents).toBe(gross - amount);
    expect((await call(ctx, 'GET', '/me/referral', { token: clientB })).body).toMatchObject({ availableCents: 0 });
    // Annulation gratuite : le crédit est rendu.
    const c = await call(ctx, 'POST', `/bookings/${created.booking.id}/cancel`, { token: clientB, body: {} });
    expect(c.body.status).toBe('cancelled_by_client');
    const back = (await call(ctx, 'GET', '/me/referral', { token: clientB })).body;
    expect(back).toMatchObject({ availableCents: amount });
    expect(back.credits[0].usedAt).toBeNull();
  });

  it('parrainage : réduction déduite à la capture, commission DEPANO diminuée d’autant, ligne de facture', async () => {
    const code = (await call(ctx, 'GET', '/me/referral', { token: clientA })).body.code;
    const amount = (await call(ctx, 'POST', '/me/referral/apply', { token: clientB, body: { code } })).body.amountCents as number;
    const created = await book(clientB, await slotIn(2));
    const id = created.booking.id as string;
    await call(ctx, 'POST', `/bookings/${id}/confirm-payment`, { token: clientB });
    await call(ctx, 'POST', `/bookings/${id}/respond`, { token: artisan, body: { accept: true } });
    for (const to of ['en_route', 'arrived']) await call(ctx, 'POST', `/bookings/${id}/transition`, { token: artisan, body: { to } });
    const q = await call(ctx, 'POST', `/bookings/${id}/quote`, { token: artisan, body: { lines: [{ kind: 'labor', label: 'Réparation', quantity: 1, unitPriceCents: 10000 }] } });
    expect(q.status).toBe(200);
    await call(ctx, 'POST', `/bookings/${id}/quote/answer`, { token: clientB, body: { accept: true } });
    await call(ctx, 'POST', `/bookings/${id}/report`, { token: artisan, body: { feasible: true } });
    const code4 = (await call(ctx, 'GET', `/bookings/${id}`, { token: clientB })).body.completionCode;
    const done = await call(ctx, 'POST', `/bookings/${id}/complete`, { token: artisan, body: { code: code4 } });
    expect(done.body.status).toBe('closed');
    const [b] = await ctx.db.select().from(s.bookings).where(eq(s.bookings.id, id));
    expect(b!.capturedCents).toBe(10000 - amount);
    expect(b!.commissionCents).toBe(Math.max(0, Math.round(10000 * 0.15) - amount));
    await ctx.jobs.run('invoices', 'generate', (d) => d.bookingId === id);
    const [inv] = await ctx.db.select().from(s.invoices).where(and(eq(s.invoices.bookingId, id), eq(s.invoices.kind, 'service')));
    expect((inv!.lines as any[]).find((l) => l.label === 'Réduction parrainage')?.totalCents).toBe(-amount);
    expect(inv!.totalCents).toBe(10000 - amount);
  });

  it('note privée de l’artisan : jamais visible du client', async () => {
    const id = await requested();
    await call(ctx, 'POST', `/bookings/${id}/respond`, { token: artisan, body: { accept: true } });
    const put = await call(ctx, 'PUT', `/bookings/${id}/artisan-note`, { token: artisan, body: { note: 'Prévoir un robinet 15/21' } });
    expect(put.status).toBe(200);
    expect(put.body.artisanNote).toBe('Prévoir un robinet 15/21');
    expect((await call(ctx, 'GET', '/bookings?as=artisan', { token: artisan })).body.items[0].artisanNote).toBe('Prévoir un robinet 15/21');
    expect((await call(ctx, 'GET', `/bookings/${id}`, { token: clientA })).body.artisanNote).toBeNull();
    expect((await call(ctx, 'GET', '/bookings', { token: clientA })).body.items[0].artisanNote).toBeNull();
    expect((await call(ctx, 'PUT', `/bookings/${id}/artisan-note`, { token: clientA, body: { note: 'x' } })).status).toBe(403);
    const cleared = await call(ctx, 'PUT', `/bookings/${id}/artisan-note`, { token: artisan, body: { note: null } });
    expect(cleared.body.artisanNote).toBeNull();
  });

  it('intervention non réalisable puis annulation : déplacement seul facturé, sans commission', async () => {
    const u = await urgentAccepted(ctx, fx);
    await call(ctx, 'POST', `/bookings/${u.id}/transition`, { token: u.artisan, body: { to: 'en_route', lat: 43.296, lng: 5.38 } });
    const early = await call(ctx, 'POST', `/bookings/${u.id}/not-feasible`, { token: u.client, body: { reason: 'client_absent', action: 'cancel' } });
    expect(early.status).toBe(403);
    const r = await call(ctx, 'POST', `/bookings/${u.id}/not-feasible`, { token: u.artisan, body: { reason: 'client_absent', comment: 'Personne à l’interphone', action: 'cancel' } });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('awaiting_code');
    expect(r.body.notFeasible).toMatchObject({ reason: 'client_absent', comment: 'Personne à l’interphone', rescheduledBookingId: null });
    expect(r.body.events.map((e: any) => e.toStatus)).toEqual(expect.arrayContaining(['arrived', 'awaiting_code']));
    expect((await notificationsOf(fx.users.clientA)).map((n) => n.title)).toContain('Intervention non réalisable');
    await ctx.jobs.run('bookings', 'auto-capture', (d) => d.bookingId === u.id);
    const [b] = await ctx.db.select().from(s.bookings).where(eq(s.bookings.id, u.id));
    expect(b).toMatchObject({ status: 'closed', travelOnly: true, capturedCents: 2500, commissionCents: 0 });
  });

  it('intervention non réalisable avec report : nouveau RDV proposé, confirmé par le paiement du client', async () => {
    const id = await requested();
    await call(ctx, 'POST', `/bookings/${id}/respond`, { token: artisan, body: { accept: true } });
    for (const to of ['en_route', 'arrived']) await call(ctx, 'POST', `/bookings/${id}/transition`, { token: artisan, body: { to } });
    // Créneau déjà pris : 409, l'intervention d'origine ne bouge pas.
    const busy = await requested(clientB, 5);
    const busyAt = (await ctx.db.select().from(s.bookings).where(eq(s.bookings.id, busy)))[0]!.scheduledAt!.toISOString();
    const conflictRes = await call(ctx, 'POST', `/bookings/${id}/not-feasible`, { token: artisan, body: { reason: 'parts_missing', action: 'reschedule', rescheduleAt: busyAt } });
    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.code).toBe('slot_unavailable');
    expect((await call(ctx, 'GET', `/bookings/${id}`, { token: artisan })).body.status).toBe('arrived');

    const at = await slotIn(4, 2);
    const r = await call(ctx, 'POST', `/bookings/${id}/not-feasible`, { token: artisan, body: { reason: 'parts_missing', comment: 'Pièce à commander', action: 'reschedule', rescheduleAt: at } });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('awaiting_code');
    const newId = r.body.notFeasible.rescheduledBookingId as string;
    expect(newId).toBeTruthy();
    const n = (await call(ctx, 'GET', `/bookings/${newId}`, { token: clientA })).body;
    expect(n).toMatchObject({ status: 'pending_payment', artisanAccepted: true, rescheduledFromId: id, scheduledAt: at, totalCents: 9000 + 2500 });
    expect(n.conversationId).toBeTruthy();
    expect((await notificationsOf(fx.users.clientA)).find((x) => x.title === 'Nouveau rendez-vous proposé')?.link).toBe(`depano://intervention/${newId}`);
    expect((await call(ctx, 'GET', '/bookings?scope=active', { token: clientA })).body.items.map((b: any) => b.id)).toContain(newId);

    const session = await call(ctx, 'POST', `/bookings/${newId}/payment-session`, { token: clientA });
    expect(session.status).toBe(200);
    const ok = await call(ctx, 'POST', `/bookings/${newId}/confirm-payment`, { token: clientA });
    expect(ok.body.status).toBe('accepted');
  });

  it('événement personnel : bloque les créneaux et apparaît dans le planning avec sa couleur', async () => {
    const at = await slotIn(2, 4);
    const end = new Date(new Date(at).getTime() + 60 * 60_000).toISOString();
    const e = await call(ctx, 'POST', '/artisan/availability/exceptions', {
      token: artisan,
      body: { startsAt: at, endsAt: end, reason: 'Manger avec Grégoire', kind: 'personal', color: 'green' },
    });
    expect(e.status).toBe(201);
    expect(e.body).toMatchObject({ kind: 'personal', color: 'green', reason: 'Manger avec Grégoire' });
    const slots = (await call(ctx, 'GET', `/artisans/${fx.artisans.a1}/slots?serviceId=${fx.services.fuite}&from=${parisDate(new Date(at))}&days=1`)).body[0].slots;
    expect(slots).not.toContain(at);
    const r = await call(ctx, 'POST', '/bookings', {
      token: clientA,
      body: { kind: 'scheduled', domain: 'plomberie', serviceId: fx.services.fuite, artisanId: fx.artisans.a1, scheduledAt: at, address: INLINE, problemReason: 'Fuite' },
    });
    expect(r.status).toBe(409);
    const planning = (await call(ctx, 'GET', `/artisan/planning?from=${new Date().toISOString()}&to=${new Date(Date.now() + 5 * 86_400_000).toISOString()}`, { token: artisan })).body;
    expect(planning.exceptions).toEqual([expect.objectContaining({ kind: 'personal', color: 'green', reason: 'Manger avec Grégoire' })]);
  });

  it('profil artisan : bannière (usage contrôlé), photos de réalisations, avatar', async () => {
    const up = await call(ctx, 'POST', '/files/upload-url', { token: artisan, body: { purpose: 'banner', contentType: 'image/jpeg', sizeBytes: 1000 } });
    const chat = await call(ctx, 'POST', '/files/upload-url', { token: artisan, body: { purpose: 'chat', contentType: 'image/jpeg', sizeBytes: 1000 } });
    expect((await call(ctx, 'PATCH', '/artisan/profile', { token: artisan, body: { bannerFileId: chat.body.fileId } })).status).toBe(400);
    const p = await call(ctx, 'PATCH', '/artisan/profile', { token: artisan, body: { bannerFileId: up.body.fileId, bio: 'Plombier passionné' } });
    expect(p.status).toBe(200);
    expect(p.body.bannerUrl).toContain(up.body.fileId);
    expect(p.body).toMatchObject({ portfolioFileIds: [], avatarUrl: null, promotion: { active: false, autoRenew: false } });
    const pub = (await call(ctx, 'GET', `/artisans/${fx.artisans.a1}`)).body;
    expect(pub.bannerUrl).toContain(up.body.fileId);
    expect(pub.promoted).toBe(false);
  });

  it('promotion : abonnement factice immédiat, mise en avant dans la recherche, résiliation et renouvellement', async () => {
    const search = async () => (await call(ctx, 'GET', `/artisans?domain=plomberie&lat=${CLIENT_POINT.lat}&lng=${CLIENT_POINT.lng}`)).body.items as any[];
    const before = await search();
    expect(before.every((c) => c.promoted === false)).toBe(true);
    const last = before.at(-1)!.id as string;
    const phone = { [fx.artisans.a1]: PHONES.artisan1, [fx.artisans.a2]: PHONES.artisan2, [fx.artisans.a3]: PHONES.artisan3 }[last]!;
    const t = await tokenOf(ctx, phone);

    expect((await call(ctx, 'GET', '/artisan/promotion', { token: t })).body).toMatchObject({ active: false, priceCents: RULES.promotion.priceCents });
    const sub = await call(ctx, 'POST', '/artisan/promotion/subscribe', { token: t });
    expect(sub.status).toBe(200);
    expect(sub.body.payment).toBeNull();
    expect(sub.body.promotion).toMatchObject({ active: true, autoRenew: true });
    const until = new Date(sub.body.promotion.until).getTime();
    expect(Math.abs(until - (Date.now() + RULES.promotion.periodDays * 86_400_000))).toBeLessThan(60_000);

    const after = await search();
    expect(after[0]).toMatchObject({ id: last, promoted: true });
    // Les autres tris ne sont pas affectés par la mise en avant.
    const byDistance = (await call(ctx, 'GET', `/artisans?domain=plomberie&sort=distance&lat=${CLIENT_POINT.lat}&lng=${CLIENT_POINT.lng}`)).body.items as any[];
    const distances = byDistance.map((c) => c.distanceKm as number);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));

    const cancelled = await call(ctx, 'POST', '/artisan/promotion/cancel', { token: t });
    expect(cancelled.body).toMatchObject({ active: true, autoRenew: false });
    const resumed = await call(ctx, 'POST', '/artisan/promotion/subscribe', { token: t });
    expect(resumed.body.promotion).toMatchObject({ active: true, autoRenew: true, until: sub.body.promotion.until });

    // Période échue avec renouvellement automatique : le job de maintenance prolonge.
    await ctx.db.update(s.artisanProfiles).set({ proUntil: new Date(Date.now() - 60_000) }).where(eq(s.artisanProfiles.id, last));
    expect((await call(ctx, 'GET', '/artisan/promotion', { token: t })).body.active).toBe(false);
    const res = (await ctx.jobs.processors!.maintenance({ name: 'promotion-renew', data: {} as never })) as any;
    expect(res.renewed).toBe(1);
    expect((await call(ctx, 'GET', '/artisan/promotion', { token: t })).body.active).toBe(true);

    // Profil non validé : pas d'abonnement.
    expect((await call(ctx, 'POST', '/artisan/promotion/subscribe', { token: await tokenOf(ctx, PHONES.pending) })).status).toBe(403);
  });
});
