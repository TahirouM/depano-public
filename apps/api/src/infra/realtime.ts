import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Emitter } from '@socket.io/redis-emitter';
import { REALTIME_ROOMS, type ServerToClientEvents } from '@depano/schemas';
import type Redis from 'ioredis';
import { AppConfig } from '../config/config.service';
import { createRedis } from './redis';

export type EventName = keyof ServerToClientEvents;
export type EventPayload<E extends EventName> = Parameters<ServerToClientEvents[E]>[0];

/**
 * Émission temps réel utilisable depuis l'API ET les workers :
 * on publie dans Redis (@socket.io/redis-emitter), l'adaptateur Redis de chaque
 * instance Socket.IO relaie aux sockets concernés.
 */
export abstract class RealtimeService {
  abstract emitToRooms<E extends EventName>(rooms: string[], event: E, payload: EventPayload<E>): void;

  emitToUser<E extends EventName>(userId: string | string[], event: E, payload: EventPayload<E>) {
    const ids = Array.isArray(userId) ? userId : [userId];
    this.emitToRooms(ids.map(REALTIME_ROOMS.user), event, payload);
  }

  emitToBooking<E extends EventName>(bookingId: string, event: E, payload: EventPayload<E>, alsoUsers: string[] = []) {
    this.emitToRooms([REALTIME_ROOMS.booking(bookingId), ...alsoUsers.map(REALTIME_ROOMS.user)], event, payload);
  }
}

@Injectable()
export class RedisRealtimeService extends RealtimeService implements OnApplicationShutdown {
  private readonly redis: Redis;
  private readonly emitter: Emitter;

  constructor(@Inject(AppConfig) config: AppConfig) {
    super();
    this.redis = createRedis(config.env.REDIS_URL);
    this.emitter = new Emitter(this.redis);
  }

  emitToRooms<E extends EventName>(rooms: string[], event: E, payload: EventPayload<E>) {
    const unique = [...new Set(rooms)];
    if (!unique.length) return;
    // Une seule émission vers plusieurs rooms : Socket.IO déduplique les destinataires.
    this.emitter.to(unique).emit(event, payload as never);
  }

  async onApplicationShutdown() {
    await this.redis.quit().catch(() => undefined);
  }
}
