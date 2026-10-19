import { expect } from 'vitest';
import { call, PHONES, tokenOf, type Fixtures, type TestContext } from './helpers';

export const ARTISAN_PHONE_BY_ID = (fx: Fixtures) => ({
  [fx.artisans.a1]: PHONES.artisan1,
  [fx.artisans.a2]: PHONES.artisan2,
  [fx.artisans.a3]: PHONES.artisan3,
});

/** Urgence créée, empreinte confirmée et dispatch démarré. */
export async function urgentSearching(ctx: TestContext, fx: Fixtures, extra: Record<string, unknown> = {}) {
  const client = await tokenOf(ctx, PHONES.clientA);
  const created = await call(ctx, 'POST', '/bookings', {
    token: client,
    body: { kind: 'urgent', domain: 'plomberie', serviceId: fx.services.fuite, addressId: fx.addressA, problemReason: 'Fuite sous évier', waivesWithdrawal: true, ...extra },
  });
  expect(created.status).toBe(201);
  const id = created.body.booking.id as string;
  const confirmed = await call(ctx, 'POST', `/bookings/${id}/confirm-payment`, { token: client });
  expect(confirmed.body.status).toBe('searching');
  await ctx.jobs.run('dispatch', 'start', (d) => d.bookingId === id);
  return { id, client, created: created.body };
}

/** Urgence acceptée par l'artisan 1. */
export async function urgentAccepted(ctx: TestContext, fx: Fixtures) {
  const s = await urgentSearching(ctx, fx);
  const artisan = await tokenOf(ctx, PHONES.artisan1);
  const offers = await call(ctx, 'GET', '/artisan/offers', { token: artisan });
  const offer = offers.body.find((o: any) => o.bookingId === s.id);
  const acc = await call(ctx, 'POST', `/artisan/offers/${offer.id}/accept`, { token: artisan });
  expect(acc.status).toBe(200);
  return { ...s, artisan };
}

/** Jusqu'à « awaiting_code » (devis sans dépassement). */
export async function urgentAwaitingCode(ctx: TestContext, fx: Fixtures, quoteCents = 15000) {
  const s = await urgentAccepted(ctx, fx);
  const t = (to: string) => call(ctx, 'POST', `/bookings/${s.id}/transition`, { token: s.artisan, body: { to, lat: 43.296, lng: 5.38 } });
  expect((await t('en_route')).status).toBe(200);
  expect((await t('arrived')).status).toBe(200);
  const q = await call(ctx, 'POST', `/bookings/${s.id}/quote`, { token: s.artisan, body: { lines: [{ kind: 'labor', label: 'Réparation', quantity: 1, unitPriceCents: quoteCents }] } });
  expect(q.status).toBe(200);
  const a = await call(ctx, 'POST', `/bookings/${s.id}/quote/answer`, { token: s.client, body: { accept: true } });
  expect(a.status).toBe(200);
  const r = await call(ctx, 'POST', `/bookings/${s.id}/report`, { token: s.artisan, body: { feasible: true, notes: 'Joint remplacé' } });
  expect(r.body.status).toBe('awaiting_code');
  return s;
}
