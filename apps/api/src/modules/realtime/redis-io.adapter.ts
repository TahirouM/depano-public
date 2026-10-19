import { IoAdapter } from '@nestjs/platform-socket.io';
import type { INestApplicationContext } from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Server, ServerOptions } from 'socket.io';
import type Redis from 'ioredis';
import { createRedis } from '../../infra/redis';

/** Adaptateur Socket.IO multi-instances (pub/sub Redis), compatible avec @socket.io/redis-emitter. */
export class RedisIoAdapter extends IoAdapter {
  private pub: Redis;
  private sub: Redis;

  constructor(app: INestApplicationContext, private readonly redisUrl: string) {
    super(app);
  }

  async connect() {
    this.pub = createRedis(this.redisUrl);
    this.sub = this.pub.duplicate();
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, { ...options, cors: { origin: true, credentials: true } }) as Server;
    server.adapter(createAdapter(this.pub, this.sub));
    return server;
  }

  async close() {
    await Promise.all([this.pub?.quit(), this.sub?.quit()].map((p) => p?.catch(() => undefined)));
  }
}
