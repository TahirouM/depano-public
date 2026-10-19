import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from '@depano/db';
import * as s from '@depano/db';
import { call, createTestApp, PHONES, resetState, seedFixtures, type TestContext } from './helpers';
import { RedisConnection } from '../src/infra/redis';

describe('Auth OTP, refresh rotatif, sessions', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => {
    await resetState(ctx);
    await seedFixtures(ctx.db);
  });

  it('crée un nouvel utilisateur + profil client au premier OTP', async () => {
    const phone = '+33612345678';
    const r1 = await call(ctx, 'POST', '/auth/otp/request', { body: { phone: '06 12 34 56 78' } });
    expect(r1.status).toBe(200);
    expect(r1.body).toMatchObject({ sent: true, retryAfterSeconds: 30 });
    expect(r1.body.devCode).toMatch(/^\d{6}$/);
    const [otp] = await ctx.db.select().from(s.otpCodes).where(eq(s.otpCodes.phone, phone));
    expect(otp!.codeHash).not.toContain(r1.body.devCode);

    const r2 = await call(ctx, 'POST', '/auth/otp/verify', { body: { phone, code: r1.body.devCode, deviceName: 'iPhone' } });
    expect(r2.status).toBe(200);
    expect(r2.body.isNewUser).toBe(true);
    expect(r2.body.expiresIn).toBe(900);
    expect(r2.body.user).toMatchObject({ phone, phoneVerified: true, roles: ['client'], activeRole: 'client', artisan: null });
    const profiles = await ctx.db.select().from(s.clientProfiles).where(eq(s.clientProfiles.userId, r2.body.user.id));
    expect(profiles).toHaveLength(1);

    const me = await call(ctx, 'GET', '/me', { token: r2.body.accessToken });
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(r2.body.user.id);

    // Utilisateur existant
    await ctx.app.get(RedisConnection).redis.flushdb();
    const r3 = await call(ctx, 'POST', '/auth/otp/request', { body: { phone } });
    const r4 = await call(ctx, 'POST', '/auth/otp/verify', { body: { phone, code: r3.body.devCode } });
    expect(r4.body.isNewUser).toBe(false);
  });

  it('limite les demandes (30 s entre deux codes)', async () => {
    expect((await call(ctx, 'POST', '/auth/otp/request', { body: { phone: PHONES.clientA } })).status).toBe(200);
    const again = await call(ctx, 'POST', '/auth/otp/request', { body: { phone: PHONES.clientA } });
    expect(again.status).toBe(429);
    expect(again.body.code).toBe('otp_cooldown');
    expect(again.body.details.retryAfterSeconds).toBeGreaterThan(0);
    expect(again.body.message).toMatch(/Patientez/);
  });

  it('bloque après 3 codes erronés', async () => {
    const r = await call(ctx, 'POST', '/auth/otp/request', { body: { phone: PHONES.clientA } });
    const wrong = r.body.devCode === '000000' ? '111111' : '000000';
    const a1 = await call(ctx, 'POST', '/auth/otp/verify', { body: { phone: PHONES.clientA, code: wrong } });
    expect(a1.status).toBe(400);
    expect(a1.body).toMatchObject({ code: 'otp_invalid', details: { attemptsLeft: 2 } });
    await call(ctx, 'POST', '/auth/otp/verify', { body: { phone: PHONES.clientA, code: wrong } });
    const a3 = await call(ctx, 'POST', '/auth/otp/verify', { body: { phone: PHONES.clientA, code: wrong } });
    expect(a3.status).toBe(429);
    expect(a3.body.code).toBe('otp_locked');
    const ok = await call(ctx, 'POST', '/auth/otp/verify', { body: { phone: PHONES.clientA, code: r.body.devCode } });
    expect(ok.status).toBe(400);
    expect(ok.body.code).toBe('otp_expired');
  });

  it('fait tourner le refresh token et révoque la famille en cas de réutilisation', async () => {
    const r = await call(ctx, 'POST', '/auth/otp/request', { body: { phone: PHONES.clientA } });
    const login = await call(ctx, 'POST', '/auth/otp/verify', { body: { phone: PHONES.clientA, code: r.body.devCode, deviceName: 'Pixel' } });
    const rt0 = login.body.refreshToken;

    const ref1 = await call(ctx, 'POST', '/auth/refresh', { body: { refreshToken: rt0 } });
    expect(ref1.status).toBe(200);
    expect(ref1.body.refreshToken).not.toBe(rt0);
    const rt1 = ref1.body.refreshToken;
    expect((await call(ctx, 'GET', '/me', { token: ref1.body.accessToken })).status).toBe(200);

    const sessions = await call(ctx, 'GET', '/auth/sessions', { token: ref1.body.accessToken });
    expect(sessions.body).toHaveLength(1);
    expect(sessions.body[0]).toMatchObject({ deviceName: 'Pixel', current: true });

    // Réutilisation de l'ancien jeton ⇒ toute la famille est révoquée
    const reuse = await call(ctx, 'POST', '/auth/refresh', { body: { refreshToken: rt0 } });
    expect(reuse.status).toBe(401);
    expect(reuse.body.code).toBe('refresh_reused');
    expect((await call(ctx, 'POST', '/auth/refresh', { body: { refreshToken: rt1 } })).status).toBe(401);
    expect((await call(ctx, 'GET', '/me', { token: ref1.body.accessToken })).status).toBe(401);
  });

  it('liste et révoque les sessions (appareils connectés), logout', async () => {
    const r = await call(ctx, 'POST', '/auth/otp/request', { body: { phone: PHONES.clientA } });
    const l1 = await call(ctx, 'POST', '/auth/otp/verify', { body: { phone: PHONES.clientA, code: r.body.devCode, deviceName: 'A' } });
    await ctx.app.get(RedisConnection).redis.flushdb();
    const r2 = await call(ctx, 'POST', '/auth/otp/request', { body: { phone: PHONES.clientA } });
    const l2 = await call(ctx, 'POST', '/auth/otp/verify', { body: { phone: PHONES.clientA, code: r2.body.devCode, deviceName: 'B' } });
    const list = await call(ctx, 'GET', '/auth/sessions', { token: l1.body.accessToken });
    expect(list.body).toHaveLength(2);
    const other = list.body.find((x: any) => !x.current);
    expect(other.deviceName).toBe('B');
    expect((await call(ctx, 'DELETE', `/auth/sessions/${other.id}`, { token: l1.body.accessToken })).status).toBe(204);
    expect((await call(ctx, 'GET', '/me', { token: l2.body.accessToken })).status).toBe(401);
    expect((await call(ctx, 'POST', '/auth/logout', { body: { refreshToken: l1.body.refreshToken } })).status).toBe(204);
    expect((await call(ctx, 'GET', '/me', { token: l1.body.accessToken })).status).toBe(401);
  });

  it('refuse un JWT invalide et renvoie des erreurs au format ApiErrorBody', async () => {
    const r = await call(ctx, 'GET', '/me', { token: 'abc.def.ghi' });
    expect(r.status).toBe(401);
    expect(r.body).toMatchObject({ statusCode: 401, code: 'invalid_token' });
    const v = await call(ctx, 'POST', '/auth/otp/verify', { body: { phone: 'x', code: '12' } });
    expect(v.status).toBe(400);
    expect(v.body.code).toBe('validation_error');
    expect(Array.isArray(v.body.details)).toBe(true);
  });
});
