import type { ArtisanSearchQuery, BookingListQuery, EstimateBody, SlotsQuery } from '@depano/schemas';

/**
 * Fabrique de clés TanStack Query. Toujours passer par ici : l'invalidation par préfixe
 * (ex. qk.bookings.all) repose sur cette hiérarchie.
 */
export const qk = {
  me: ['me'] as const,
  badges: ['me', 'badges'] as const,
  addresses: ['me', 'addresses'] as const,
  favorites: ['me', 'favorites'] as const,
  paymentMethods: ['me', 'payment-methods'] as const,
  invoices: ['me', 'invoices'] as const,
  notificationPrefs: ['me', 'notification-preferences'] as const,
  referral: ['me', 'referral'] as const,
  sessions: ['auth', 'sessions'] as const,

  catalog: {
    all: ['catalog'] as const,
    domains: ['catalog', 'domains'] as const,
    search: (q: Partial<ArtisanSearchQuery>) => ['catalog', 'artisans', q] as const,
    artisan: (id: string) => ['catalog', 'artisan', id] as const,
    slots: (id: string, q: Partial<SlotsQuery>) => ['catalog', 'artisan', id, 'slots', q] as const,
    reviews: (id: string) => ['catalog', 'artisan', id, 'reviews'] as const,
    estimate: (b: Partial<EstimateBody>) => ['catalog', 'estimate', b] as const,
    address: (q: string) => ['catalog', 'address', q] as const,
  },

  /**
   * État poussé par le temps réel, jamais refetché (hors du préfixe `bookings` : une invalidation ne l'écrase pas).
   */
  live: {
    dispatch: (bookingId: string) => ['live', 'dispatch', bookingId] as const,
  },

  bookings: {
    all: ['bookings'] as const,
    lists: ['bookings', 'list'] as const,
    list: (q: Partial<BookingListQuery>) => ['bookings', 'list', q] as const,
    active: (as: 'client' | 'artisan') => ['bookings', 'list', { as, scope: 'active' }] as const,
    detail: (id: string) => ['bookings', 'detail', id] as const,
  },

  artisan: {
    all: ['artisan'] as const,
    profile: ['artisan', 'profile'] as const,
    dashboard: ['artisan', 'dashboard'] as const,
    planning: (from: string, to: string) => ['artisan', 'planning', from, to] as const,
    offers: ['artisan', 'offers'] as const,
    /** Préfixée par `offers` : invalider la liste rafraîchit aussi le détail. */
    offer: (id: string) => ['artisan', 'offers', 'detail', id] as const,
    earnings: ['artisan', 'earnings'] as const,
    stats: ['artisan', 'stats'] as const,
    reviews: ['artisan', 'reviews'] as const,
    exceptions: ['artisan', 'exceptions'] as const,
  },

  chat: {
    conversations: ['chat', 'conversations'] as const,
    messages: (conversationId: string) => ['chat', 'messages', conversationId] as const,
  },

  notifications: {
    list: ['notifications', 'list'] as const,
  },
} as const;

/** Clés de mutation (setMutationDefaults) : rejouables après redémarrage hors ligne. */
export const mk = {
  chatSend: ['chat', 'send'] as const,
} as const;
