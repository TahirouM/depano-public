import type { BookingStatus } from './enums';
import type { MessageDto, NotificationDto, UrgentOfferDto } from './dto';

/**
 * Contrat WebSocket (Socket.IO). Connexion : io(API_URL, { auth: { token: accessToken } }).
 * Le serveur place chaque socket dans la room `user:{userId}` ; la room `booking:{id}`
 * est rejointe via `booking.subscribe` après contrôle d'accès.
 */
export interface ServerToClientEvents {
  'booking.updated': (e: { bookingId: string; status: BookingStatus; at: string }) => void;
  'booking.location': (e: { bookingId: string; lat: number; lng: number; heading: number | null; etaMinutes: number | null; at: string }) => void;
  'booking.dispatch': (e: { bookingId: string; wave: number; contacted: number; radiusKm: number }) => void;
  'message.created': (e: MessageDto) => void;
  'message.read': (e: { conversationId: string; userId: string; at: string }) => void;
  'typing': (e: { conversationId: string; userId: string }) => void;
  'notification.created': (e: NotificationDto) => void;
  'offer.created': (e: UrgentOfferDto) => void;
  'offer.revoked': (e: { offerId: string; bookingId: string; reason: 'taken' | 'expired' | 'cancelled' }) => void;
}

export interface ClientToServerEvents {
  'booking.subscribe': (e: { bookingId: string }, ack: (r: { ok: boolean }) => void) => void;
  'booking.unsubscribe': (e: { bookingId: string }) => void;
  'location.update': (e: { bookingId: string; lat: number; lng: number; heading?: number; speed?: number }) => void;
  'typing': (e: { conversationId: string }) => void;
}

export const REALTIME_ROOMS = {
  user: (id: string) => `user:${id}`,
  booking: (id: string) => `booking:${id}`,
  conversation: (id: string) => `conversation:${id}`,
} as const;

/** Liens profonds de l'app mobile. */
export const DEEP_LINKS = {
  scheme: 'depano',
  intervention: (id: string) => `depano://intervention/${id}`,
  conversation: (id: string) => `depano://messages/${id}`,
  offer: (id: string) => `depano://offre/${id}`,
  artisan: (id: string) => `depano://artisan/${id}`,
} as const;

/** Files BullMQ partagées entre API et workers. */
export const QUEUES = {
  dispatch: 'dispatch',
  notifications: 'notifications',
  bookings: 'bookings',
  files: 'files',
  invoices: 'invoices',
  maintenance: 'maintenance',
} as const;

export interface DispatchJobs {
  'start': { bookingId: string };
  'wave-timeout': { bookingId: string; wave: number };
}
export interface NotificationJobs {
  'push': { userId: string; title: string; body: string; link?: string; data?: Record<string, unknown> };
  'sms': { phone: string; body: string };
}
export interface BookingJobs {
  'auto-capture': { bookingId: string };
  'reminder': { bookingId: string; kind: 'day_before' | 'hour_before' };
  'authorize-scheduled': { bookingId: string };
  'quote-expire': { bookingId: string; quoteId: string };
  'request-expire': { bookingId: string };
}
export interface FileJobs {
  'thumbnail': { fileId: string };
}
export interface InvoiceJobs {
  'generate': { bookingId: string };
}
export interface MaintenanceJobs {
  'document-expiry': Record<string, never>;
  'data-retention': Record<string, never>;
  'reliability': Record<string, never>;
  'promotion-renew': Record<string, never>;
}
