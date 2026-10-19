import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { AuthTokens, Role, SessionDto } from '@depano/schemas';
import { and, desc, eq, gt, isNull, sessions, users } from '@depano/db';
import { AppConfig } from '../../config/config.service';
import { DbConnection } from '../../infra/db';
import { hmac, randomToken } from '../../common/crypto';
import type { AuthUser } from '../../common/auth';
import { notFound, unauthorized } from '../../common/errors';

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_DAYS = 30;

export interface SessionMeta {
  deviceName?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/** JWT d'accès 15 min + refresh token rotatif (haché en base, détection de réutilisation par famille). */
@Injectable()
export class TokenService {
  private readonly accessKey: Uint8Array;

  constructor(
    @Inject(AppConfig) private readonly config: AppConfig,
    @Inject(DbConnection) private readonly conn: DbConnection,
  ) {
    this.accessKey = new TextEncoder().encode(config.env.JWT_ACCESS_SECRET);
  }

  private hashRefresh(token: string) {
    return hmac(this.config.env.JWT_REFRESH_SECRET, token);
  }

  private async signAccess(userId: string, sessionId: string, roles: Role[]) {
    return new SignJWT({ sid: sessionId, roles })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setIssuer('depano')
      .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
      .sign(this.accessKey);
  }

  async issue(userId: string, meta: SessionMeta, familyId: string = randomUUID()): Promise<AuthTokens & { sessionId: string }> {
    const refreshToken = randomToken(32);
    const [s] = await this.conn.db
      .insert(sessions)
      .values({
        userId,
        refreshTokenHash: this.hashRefresh(refreshToken),
        familyId,
        deviceName: meta.deviceName ?? null,
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
        expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000),
      })
      .returning({ id: sessions.id });
    const [u] = await this.conn.db.select({ roles: users.roles }).from(users).where(eq(users.id, userId));
    const accessToken = await this.signAccess(userId, s!.id, (u?.roles ?? ['client']) as Role[]);
    return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS, sessionId: s!.id };
  }

  /** Vérifie un jeton d'accès et recharge l'utilisateur (rôles à jour, session active). */
  async authenticate(token: string): Promise<AuthUser | null> {
    let sub: string | undefined;
    let sid: string | undefined;
    try {
      const { payload } = await jwtVerify(token, this.accessKey, { issuer: 'depano', algorithms: ['HS256'] });
      sub = payload.sub;
      sid = payload.sid as string | undefined;
    } catch {
      return null;
    }
    if (!sub || !sid) return null;
    const [row] = await this.conn.db
      .select({
        id: users.id,
        roles: users.roles,
        activeRole: users.activeRole,
        phone: users.phone,
        deletedAt: users.deletedAt,
        suspendedAt: users.suspendedAt,
        revokedAt: sessions.revokedAt,
      })
      .from(users)
      .innerJoin(sessions, eq(sessions.userId, users.id))
      .where(and(eq(users.id, sub), eq(sessions.id, sid)));
    if (!row || row.deletedAt || row.suspendedAt || row.revokedAt) return null;
    return { id: row.id, sessionId: sid, roles: row.roles as Role[], activeRole: row.activeRole as Role, phone: row.phone };
  }

  /** Rotation : l'ancien jeton est révoqué ; s'il est présenté à nouveau, toute la famille est révoquée. */
  async refresh(refreshToken: string, meta: SessionMeta): Promise<AuthTokens> {
    const hash = this.hashRefresh(refreshToken);
    const result = await this.conn.db.transaction(async (tx) => {
      const [s] = await tx.select().from(sessions).where(eq(sessions.refreshTokenHash, hash)).for('update');
      if (!s) return { error: 'invalid' as const };
      if (s.revokedAt) {
        await tx.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.familyId, s.familyId), isNull(sessions.revokedAt)));
        return { error: 'reused' as const };
      }
      if (s.expiresAt < new Date()) return { error: 'expired' as const };
      const [u] = await tx.select({ deletedAt: users.deletedAt, suspendedAt: users.suspendedAt }).from(users).where(eq(users.id, s.userId));
      if (!u || u.deletedAt || u.suspendedAt) return { error: 'invalid' as const };
      await tx.update(sessions).set({ revokedAt: new Date(), lastUsedAt: new Date() }).where(eq(sessions.id, s.id));
      return { session: s };
    });
    if ('error' in result) {
      if (result.error === 'reused') throw unauthorized('refresh_reused', 'Session révoquée par sécurité, reconnectez-vous.');
      throw unauthorized('invalid_refresh', 'Session expirée, reconnectez-vous.');
    }
    const s = result.session;
    const { sessionId: _, ...tokens } = await this.issue(
      s.userId,
      { deviceName: s.deviceName, ip: meta.ip ?? s.ip, userAgent: meta.userAgent ?? s.userAgent },
      s.familyId,
    );
    return tokens;
  }

  async logout(refreshToken: string) {
    const hash = this.hashRefresh(refreshToken);
    const [s] = await this.conn.db.select().from(sessions).where(eq(sessions.refreshTokenHash, hash));
    if (s) await this.revokeFamily(s.familyId);
  }

  async revokeFamily(familyId: string) {
    await this.conn.db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.familyId, familyId), isNull(sessions.revokedAt)));
  }

  async revokeAllForUser(userId: string) {
    await this.conn.db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }

  /** « Appareils connectés » : une entrée par famille active. */
  async list(user: AuthUser): Promise<SessionDto[]> {
    const rows = await this.conn.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, user.id), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
      .orderBy(desc(sessions.lastUsedAt));
    const [current] = await this.conn.db.select({ familyId: sessions.familyId }).from(sessions).where(eq(sessions.id, user.sessionId));
    const families = await this.conn.db
      .select({ familyId: sessions.familyId, createdAt: sessions.createdAt })
      .from(sessions)
      .where(eq(sessions.userId, user.id))
      .orderBy(sessions.createdAt);
    const firstSeen = new Map<string, Date>();
    for (const f of families) if (!firstSeen.has(f.familyId)) firstSeen.set(f.familyId, f.createdAt);
    return rows.map((s) => ({
      id: s.id,
      deviceName: s.deviceName,
      createdAt: (firstSeen.get(s.familyId) ?? s.createdAt).toISOString(),
      lastUsedAt: s.createdAt > s.lastUsedAt ? s.createdAt.toISOString() : s.lastUsedAt.toISOString(),
      current: s.familyId === current?.familyId,
    }));
  }

  async revoke(user: AuthUser, sessionId: string) {
    const [s] = await this.conn.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)));
    if (!s) throw notFound('session_not_found', 'Session introuvable.');
    await this.revokeFamily(s.familyId);
  }
}
