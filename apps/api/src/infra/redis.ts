import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfig } from '../config/config.service';
import type { Env } from '../config/env';
import { tooMany } from '../common/errors';

export function createRedis(url: string, opts: { forBullmq?: boolean } = {}) {
  return new Redis(url, {
    maxRetriesPerRequest: opts.forBullmq ? null : 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });
}

@Injectable()
export class RedisConnection implements OnApplicationShutdown {
  readonly redis: Redis;
  constructor(@Inject(AppConfig) config: AppConfig) {
    this.redis = createRedis(config.env.REDIS_URL);
  }
  async onApplicationShutdown() {
    await this.redis.quit().catch(() => undefined);
  }
}

/**
 * Coefficient appliqué aux plafonds : 1 en production (valeurs contractuelles, variables ignorées),
 * Infinity si RATE_LIMIT_DISABLED=true, sinon RATE_LIMIT_MULTIPLIER (défaut ×20 en développement, ×1 en test pour
 * que les tests vérifient les valeurs de production).
 */
export function rateLimitFactor(env: Pick<Env, 'NODE_ENV' | 'RATE_LIMIT_DISABLED' | 'RATE_LIMIT_MULTIPLIER'>): number {
  if (env.NODE_ENV === 'production') return 1;
  if (env.RATE_LIMIT_DISABLED) return Number.POSITIVE_INFINITY;
  return env.RATE_LIMIT_MULTIPLIER ?? (env.NODE_ENV === 'development' ? 20 : 1);
}

/** Limitation de débit à fenêtre fixe dans Redis. */
@Injectable()
export class RateLimiter {
  readonly factor: number;
  constructor(
    @Inject(RedisConnection) private readonly conn: RedisConnection,
    @Inject(AppConfig) config: AppConfig,
  ) {
    this.factor = rateLimitFactor(config.env);
  }

  /** Incrémente le compteur et lève 429 au-delà de `limit` (× coefficient hors production) dans la fenêtre. */
  async hit(key: string, limit: number, windowSeconds: number, message = 'Trop de tentatives, réessayez plus tard.') {
    if (this.factor === Number.POSITIVE_INFINITY) return 0;
    limit = Math.ceil(limit * this.factor);
    const k = `rl:${key}`;
    const [[, count], [, ttl]] = (await this.conn.redis.multi().incr(k).ttl(k).exec()) as [[null, number], [null, number]];
    if (ttl < 0) await this.conn.redis.expire(k, windowSeconds);
    if (count > limit) {
      const retryAfterSeconds = ttl > 0 ? ttl : windowSeconds;
      throw tooMany('rate_limited', message, { retryAfterSeconds });
    }
    return count;
  }

  /** Délai minimal entre deux actions (SET NX EX). Renvoie le temps restant si bloqué. */
  /** Délai effectif (divisé par le coefficient hors production, 0 si désactivé). */
  cooldownSeconds(seconds: number): number {
    return this.factor === Number.POSITIVE_INFINITY ? 0 : Math.max(1, Math.ceil(seconds / this.factor));
  }

  async cooldown(key: string, seconds: number): Promise<number> {
    seconds = this.cooldownSeconds(seconds);
    if (seconds === 0) return 0;
    const k = `cd:${key}`;
    const ok = await this.conn.redis.set(k, '1', 'EX', seconds, 'NX');
    if (ok) return 0;
    const ttl = await this.conn.redis.ttl(k);
    return ttl > 0 ? ttl : seconds;
  }
}
