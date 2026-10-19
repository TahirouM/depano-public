import { Inject, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { LocationBody, REALTIME_ROOMS, type ClientToServerEvents, type ServerToClientEvents } from '@depano/schemas';
import { z } from 'zod';
import type { AuthUser } from '../../common/auth';
import { TokenService } from '../auth/token.service';
import { BookingsService } from '../bookings/bookings.service';
import { ChatService } from '../chat/chat.service';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, { user: AuthUser }>;

const SubscribeBody = z.object({ bookingId: z.string().uuid() });
const LocationEvent = LocationBody.extend({ bookingId: z.string().uuid() });
const TypingBody = z.object({ conversationId: z.string().uuid() });

/**
 * Temps réel : JWT dans handshake.auth.token, room user:{id} automatique,
 * booking:{id} (+ conversation) après contrôle d'accès.
 */
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger('Realtime');
  @WebSocketServer() server: Server;

  constructor(
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(BookingsService) private readonly bookings: BookingsService,
    @Inject(ChatService) private readonly chat: ChatService,
  ) {}

  async handleConnection(socket: AppSocket) {
    const header = socket.handshake.headers.authorization;
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : undefined) ??
      (socket.handshake.query?.token as string | undefined);
    const user = token ? await this.tokens.authenticate(token) : null;
    if (!user) {
      socket.disconnect(true);
      return;
    }
    socket.data.user = user;
    await socket.join(REALTIME_ROOMS.user(user.id));
  }

  @SubscribeMessage('booking.subscribe')
  async subscribe(@ConnectedSocket() socket: AppSocket, @MessageBody() body: unknown) {
    const user = socket.data.user;
    const parsed = SubscribeBody.safeParse(body);
    if (!user || !parsed.success) return { ok: false };
    if (!(await this.bookings.canAccess(user, parsed.data.bookingId))) return { ok: false };
    await socket.join(REALTIME_ROOMS.booking(parsed.data.bookingId));
    const conv = await this.chat.conversationForBooking(parsed.data.bookingId);
    if (conv && (conv.clientUserId === user.id || conv.artisanUserId === user.id)) await socket.join(REALTIME_ROOMS.conversation(conv.id));
    return { ok: true };
  }

  @SubscribeMessage('booking.unsubscribe')
  async unsubscribe(@ConnectedSocket() socket: AppSocket, @MessageBody() body: unknown) {
    const parsed = SubscribeBody.safeParse(body);
    if (parsed.success) await socket.leave(REALTIME_ROOMS.booking(parsed.data.bookingId));
  }

  @SubscribeMessage('location.update')
  async location(@ConnectedSocket() socket: AppSocket, @MessageBody() body: unknown) {
    const user = socket.data.user;
    const parsed = LocationEvent.safeParse(body);
    if (!user || !parsed.success) return { ok: false };
    const { bookingId, ...loc } = parsed.data;
    try {
      await this.bookings.updateLocation(user, bookingId, loc);
      return { ok: true };
    } catch (e) {
      this.logger.debug(`location.update refusée : ${e}`);
      return { ok: false };
    }
  }

  @SubscribeMessage('typing')
  async typing(@ConnectedSocket() socket: AppSocket, @MessageBody() body: unknown) {
    const user = socket.data.user;
    const parsed = TypingBody.safeParse(body);
    if (!user || !parsed.success) return;
    if (!(await this.chat.isParticipant(user.id, parsed.data.conversationId))) return;
    socket.to(REALTIME_ROOMS.conversation(parsed.data.conversationId)).emit('typing', { conversationId: parsed.data.conversationId, userId: user.id });
  }
}
