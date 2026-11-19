import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { RULES, type AuthResult } from '@depano/schemas';
import { and, clientProfiles, desc, eq, gt, isNull, otpCodes, passkeys, users } from '@depano/db';
import { AppConfig } from '../../config/config.service';
import { DbConnection } from '../../infra/db';
import { RateLimiter, RedisConnection } from '../../infra/redis';
import { SMS_PROVIDER } from '../../infra/tokens';
import type { SmsProvider } from '../../providers/messaging.providers';
import { hmac, randomDigits, randomToken, safeEqual } from '../../common/crypto';
import type { AuthUser } from '../../common/auth';
import { badRequest, forbidden, tooMany, unauthorized, unavailable } from '../../common/errors';
import { TokenService, type SessionMeta } from './token.service';
import { MeService } from '../me/me.service';

export const OTP_COOLDOWN_SECONDS = 30;
export const OTP_MAX_PER_HOUR = 5;
export const OTP_MAX_PER_IP_HOUR = 30;

const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(
    @Inject(AppConfig) private readonly config: AppConfig,
    @Inject(DbConnection) private readonly conn: DbConnection,
    @Inject(RedisConnection) private readonly redisConn: RedisConnection,
    @Inject(RateLimiter) private readonly limiter: RateLimiter,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(MeService) private readonly me: MeService,
  ) {}

  private otpHash(phone: string, code: string) {
    return hmac(this.config.env.OTP_PEPPER, `${phone}:${code}`);
  }

  /* ------------------------------- OTP --------------------------------- */

  async requestOtp(phone: string, ip: string) {
    await this.limiter.hit(`otp:ip:${ip}`, OTP_MAX_PER_IP_HOUR, 3600, 'Trop de demandes de code depuis ce réseau, réessayez plus tard.');
    const wait = await this.limiter.cooldown(`otp:${phone}`, OTP_COOLDOWN_SECONDS);
    if (wait > 0) throw tooMany('otp_cooldown', `Patientez ${wait} s avant de redemander un code.`, { retryAfterSeconds: wait });
    await this.limiter.hit(`otp:h:${phone}`, OTP_MAX_PER_HOUR, 3600, "Trop de codes demandés pour ce numéro, réessayez dans une heure.");
    const code = randomDigits(RULES.otp.length);
    await this.conn.db
      .update(otpCodes)
      .set({ consumedAt: new Date() })
      .where(and(eq(otpCodes.phone, phone), isNull(otpCodes.consumedAt)));
    await this.conn.db.insert(otpCodes).values({
      phone,
      codeHash: this.otpHash(phone, code),
      expiresAt: new Date(Date.now() + RULES.otp.ttlSeconds * 1000),
      ip,
    });
    await this.sms.send(phone, `DEPANO : votre code de connexion est ${code}. Il expire dans 5 minutes. Ne le communiquez à personne.`);
    return { sent: true as const, retryAfterSeconds: this.limiter.cooldownSeconds(OTP_COOLDOWN_SECONDS), ...(this.config.isProd && !this.config.env.OTP_EXPOSE_CODE ? {} : { devCode: code }) };
  }

  async verifyOtp(phone: string, code: string, meta: SessionMeta): Promise<AuthResult> {
    const [otp] = await this.conn.db
      .select()
      .from(otpCodes)
      .where(and(eq(otpCodes.phone, phone), isNull(otpCodes.consumedAt), gt(otpCodes.expiresAt, new Date())))
      .orderBy(desc(otpCodes.createdAt))
      .limit(1);
    if (!otp) throw badRequest('otp_expired', 'Code expiré ou inexistant. Demandez un nouveau code.');
    if (otp.attempts >= RULES.otp.maxAttempts) throw tooMany('otp_locked', 'Trop de codes erronés. Demandez un nouveau code.');
    if (!safeEqual(this.otpHash(phone, code), otp.codeHash)) {
      const attempts = otp.attempts + 1;
      await this.conn.db
        .update(otpCodes)
        .set({ attempts, ...(attempts >= RULES.otp.maxAttempts ? { consumedAt: new Date() } : {}) })
        .where(eq(otpCodes.id, otp.id));
      const left = RULES.otp.maxAttempts - attempts;
      if (left <= 0) throw tooMany('otp_locked', 'Trop de codes erronés. Demandez un nouveau code.');
      throw badRequest('otp_invalid', `Code incorrect. Il vous reste ${left} essai${left > 1 ? 's' : ''}.`, { attemptsLeft: left });
    }
    // Consommation atomique : un même code ne peut ouvrir qu'une session.
    const consumed = await this.conn.db
      .update(otpCodes)
      .set({ consumedAt: new Date() })
      .where(and(eq(otpCodes.id, otp.id), isNull(otpCodes.consumedAt)))
      .returning({ id: otpCodes.id });
    if (!consumed.length) throw badRequest('otp_expired', 'Code déjà utilisé. Demandez un nouveau code.');

    let [user] = await this.conn.db.select().from(users).where(and(eq(users.phone, phone), isNull(users.deletedAt)));
    let isNewUser = false;
    if (!user) {
      [user] = await this.conn.db.insert(users).values({ phone, phoneVerifiedAt: new Date(), roles: ['client'], activeRole: 'client' }).returning();
      await this.conn.db.insert(clientProfiles).values({ userId: user!.id, referralCode: randomToken(6).replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase() }).onConflictDoNothing();
      isNewUser = true;
    } else if (!user.phoneVerifiedAt) {
      await this.conn.db.update(users).set({ phoneVerifiedAt: new Date() }).where(eq(users.id, user.id));
    }
    return this.login(user!.id, meta, isNewUser);
  }

  private async login(userId: string, meta: SessionMeta, isNewUser: boolean): Promise<AuthResult> {
    const [u] = await this.conn.db.select({ suspendedAt: users.suspendedAt }).from(users).where(eq(users.id, userId));
    if (u?.suspendedAt) throw forbidden('account_suspended', 'Votre compte est suspendu. Contactez le support.');
    const { sessionId: _, ...tokens } = await this.tokens.issue(userId, meta);
    return { ...tokens, user: await this.me.toMe(userId), isNewUser };
  }

  /* --------------------------- Apple / Google -------------------------- */

  private async verifyIdToken(kind: 'apple' | 'google', token: string): Promise<JWTPayload> {
    const audience = kind === 'apple' ? this.config.env.APPLE_CLIENT_ID : this.config.env.GOOGLE_CLIENT_ID;
    if (!audience) throw unavailable('provider_not_configured', `Connexion ${kind === 'apple' ? 'Apple' : 'Google'} non configurée.`);
    try {
      const { payload } = await jwtVerify(token, kind === 'apple' ? APPLE_JWKS : GOOGLE_JWKS, {
        issuer: kind === 'apple' ? 'https://appleid.apple.com' : ['https://accounts.google.com', 'accounts.google.com'],
        audience: audience.split(',').map((a) => a.trim()),
      });
      return payload;
    } catch (e) {
      this.logger.warn(`jeton ${kind} refusé : ${e}`);
      throw unauthorized('invalid_identity_token', 'Connexion refusée : jeton d’identité invalide.');
    }
  }

  async socialLogin(kind: 'apple' | 'google', token: string, profile: { firstName?: string; lastName?: string }, meta: SessionMeta): Promise<AuthResult> {
    const payload = await this.verifyIdToken(kind, token);
    const sub = payload.sub!;
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
    const subCol = kind === 'apple' ? users.appleSub : users.googleSub;
    let [user] = await this.conn.db.select().from(users).where(and(eq(subCol, sub), isNull(users.deletedAt)));
    let isNewUser = false;
    if (!user && email && payload.email_verified !== false && payload.email_verified !== 'false') {
      [user] = await this.conn.db.select().from(users).where(and(eq(users.email, email), isNull(users.deletedAt)));
      if (user) await this.conn.db.update(users).set(kind === 'apple' ? { appleSub: sub } : { googleSub: sub }).where(eq(users.id, user.id));
    }
    if (!user) {
      const givenName = kind === 'google' && typeof payload.given_name === 'string' ? payload.given_name : profile.firstName;
      const familyName = kind === 'google' && typeof payload.family_name === 'string' ? payload.family_name : profile.lastName;
      [user] = await this.conn.db
        .insert(users)
        .values({ email, firstName: givenName ?? null, lastName: familyName ?? null, roles: ['client'], activeRole: 'client', ...(kind === 'apple' ? { appleSub: sub } : { googleSub: sub }) })
        .returning();
      await this.conn.db.insert(clientProfiles).values({ userId: user!.id }).onConflictDoNothing();
      isNewUser = true;
    }
    return this.login(user!.id, meta, isNewUser);
  }

  /* ------------------------------ Passkeys ----------------------------- */

  private get origins() {
    return this.config.env.WEBAUTHN_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  }

  async passkeyRegisterOptions(user: AuthUser) {
    const [u] = await this.conn.db.select().from(users).where(eq(users.id, user.id));
    const existing = await this.conn.db.select().from(passkeys).where(eq(passkeys.userId, user.id));
    const options = await generateRegistrationOptions({
      rpName: 'DEPANO',
      rpID: this.config.env.WEBAUTHN_RP_ID,
      userName: u?.phone ?? u?.email ?? user.id,
      userDisplayName: [u?.firstName, u?.lastName].filter(Boolean).join(' ') || 'Utilisateur DEPANO',
      userID: new TextEncoder().encode(user.id),
      attestationType: 'none',
      excludeCredentials: existing.map((p) => ({ id: p.credentialId, transports: p.transports ?? undefined })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });
    await this.redisConn.redis.set(`passkey:reg:${user.id}`, options.challenge, 'EX', 300);
    return options as unknown as Record<string, unknown>;
  }

  async passkeyRegisterVerify(user: AuthUser, response: Record<string, unknown>, deviceName?: string) {
    const challenge = await this.redisConn.redis.getdel(`passkey:reg:${user.id}`);
    if (!challenge) throw badRequest('passkey_challenge_expired', 'Demande expirée, recommencez.');
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: response as never,
        expectedChallenge: challenge,
        expectedOrigin: this.origins,
        expectedRPID: this.config.env.WEBAUTHN_RP_ID,
      });
    } catch (e) {
      throw badRequest('passkey_invalid', `Passkey refusée : ${(e as Error).message}`);
    }
    if (!verification.verified || !verification.registrationInfo) throw badRequest('passkey_invalid', 'Passkey refusée.');
    const { credential } = verification.registrationInfo;
    await this.conn.db
      .insert(passkeys)
      .values({
        userId: user.id,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        counter: credential.counter,
        transports: credential.transports ?? null,
        deviceName: deviceName ?? null,
      })
      .onConflictDoNothing();
    return { ok: true as const };
  }

  async passkeyLoginOptions(phone?: string) {
    let userId: string | null = null;
    let allow: { id: string; transports?: string[] }[] = [];
    if (phone) {
      const [u] = await this.conn.db.select({ id: users.id }).from(users).where(and(eq(users.phone, phone), isNull(users.deletedAt)));
      if (u) {
        userId = u.id;
        const keys = await this.conn.db.select().from(passkeys).where(eq(passkeys.userId, u.id));
        allow = keys.map((k) => ({ id: k.credentialId, transports: k.transports ?? undefined }));
      }
    }
    const options = await generateAuthenticationOptions({
      rpID: this.config.env.WEBAUTHN_RP_ID,
      allowCredentials: allow as never,
      userVerification: 'preferred',
    });
    const challengeId = randomUUID();
    await this.redisConn.redis.set(`passkey:auth:${challengeId}`, JSON.stringify({ challenge: options.challenge, userId }), 'EX', 300);
    return { challengeId, options: options as unknown as Record<string, unknown> };
  }

  async passkeyLoginVerify(challengeId: string, response: Record<string, unknown>, meta: SessionMeta): Promise<AuthResult> {
    const raw = await this.redisConn.redis.getdel(`passkey:auth:${challengeId}`);
    if (!raw) throw badRequest('passkey_challenge_expired', 'Demande expirée, recommencez.');
    const { challenge, userId } = JSON.parse(raw) as { challenge: string; userId: string | null };
    const credentialId = String(response.id ?? '');
    const [key] = await this.conn.db.select().from(passkeys).where(eq(passkeys.credentialId, credentialId));
    if (!key || (userId && key.userId !== userId)) throw unauthorized('passkey_unknown', 'Passkey inconnue.');
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: response as never,
        expectedChallenge: challenge,
        expectedOrigin: this.origins,
        expectedRPID: this.config.env.WEBAUTHN_RP_ID,
        credential: {
          id: key.credentialId,
          publicKey: new Uint8Array(Buffer.from(key.publicKey, 'base64url')),
          counter: key.counter,
          transports: (key.transports ?? undefined) as never,
        },
      });
    } catch (e) {
      throw unauthorized('passkey_invalid', `Passkey refusée : ${(e as Error).message}`);
    }
    if (!verification.verified) throw unauthorized('passkey_invalid', 'Passkey refusée.');
    await this.conn.db
      .update(passkeys)
      .set({ counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() })
      .where(eq(passkeys.id, key.id));
    const [u] = await this.conn.db.select({ deletedAt: users.deletedAt }).from(users).where(eq(users.id, key.userId));
    if (!u || u.deletedAt) throw unauthorized('passkey_unknown', 'Passkey inconnue.');
    return this.login(key.userId, meta, false);
  }
}
