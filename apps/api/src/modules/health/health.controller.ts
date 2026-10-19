import { Controller, Get, Inject, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { sql } from '@depano/db';
import { Public } from '../../common/auth';
import { DbConnection } from '../../infra/db';
import { RedisConnection } from '../../infra/redis';

@ApiTags('santé')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DbConnection) private readonly conn: DbConnection,
    @Inject(RedisConnection) private readonly redis: RedisConnection,
  ) {}

  @Public()
  @Get()
  async health(@Res({ passthrough: true }) reply: FastifyReply) {
    const check = async (fn: () => Promise<unknown>) => {
      try {
        await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000))]);
        return true;
      } catch {
        return false;
      }
    };
    const [db, redis] = await Promise.all([check(() => this.conn.db.execute(sql`select 1`)), check(() => this.redis.redis.ping())]);
    const ok = db && redis;
    if (!ok) reply.status(503);
    return { status: ok ? 'ok' : 'degraded', db, redis, time: new Date().toISOString() };
  }
}
