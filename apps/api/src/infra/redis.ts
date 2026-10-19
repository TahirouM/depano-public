import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfig } from '../config/config.service';
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

/** Limitation de débit à fenêtre fixe dans Redis. */
@Injectable()
export class RateLimiter {
  constructor(@Inject(RedisConnection) private readonly conn: RedisConnection) {}

  /** Incrémente le compteur et lève 429 au-delà de `limit` dans la fenêtre. */
  async hit(key: string, limit: number, windowSeconds: number, message = 'Trop de tentatives, réessayez plus tard.') {
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
  async cooldown(key: string, seconds: number): Promise<number> {
    const k = `cd:${key}`;
    const ok = await this.conn.redis.set(k, '1', 'EX', seconds, 'NX');
    if (ok) return 0;
    const ttl = await this.conn.redis.ttl(k);
    return ttl > 0 ? ttl : seconds;
  }
}
