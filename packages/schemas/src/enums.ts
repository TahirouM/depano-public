import { z } from 'zod';

/** Rôles applicatifs. Un même utilisateur peut cumuler client et artisan. */
export const ROLES = ['client', 'artisan', 'support', 'admin'] as const;
export const Role = z.enum(ROLES);
export type Role = z.infer<typeof Role>;

/** Métiers couverts au lancement (Marseille). */
export const DOMAIN_CODES = ['plomberie', 'electricite', 'energetique'] as const;
export const DomainCode = z.enum(DOMAIN_CODES);
export type DomainCode = z.infer<typeof DomainCode>;

export const DOMAIN_LABELS: Record<DomainCode, string> = {
  plomberie: 'Plomberie',
  electricite: 'Électricité',
  energetique: 'Énergétique',
};

export const BOOKING_KINDS = ['urgent', 'scheduled'] as const;
export const BookingKind = z.enum(BOOKING_KINDS);
export type BookingKind = z.infer<typeof BookingKind>;

/** Type de RDV planifié. */
export const SCHEDULED_TYPES = ['maintenance', 'repair'] as const;
export const ScheduledType = z.enum(SCHEDULED_TYPES);
export type ScheduledType = z.infer<typeof ScheduledType>;

/**
 * Cycle de vie d'une intervention : 9 états + 4 sorties.
 * Voir booking-machine.ts pour les transitions autorisées.
 */
export const BOOKING_STATUSES = [
  'pending_payment', // empreinte bancaire en cours
  'searching', // urgence : dispatch en cours
  'accepted', // artisan assigné
  'en_route',
  'arrived',
  'quote_pending', // devis envoyé, en attente de validation client
  'in_progress', // devis validé, travaux en cours
  'awaiting_code', // travaux terminés, en attente du code de fin
  'closed', // code validé (ou capture auto 24 h), paiement capturé
  // sorties
  'cancelled_by_client',
  'cancelled_by_artisan',
  'expired', // aucun artisan n'a accepté
  'disputed',
] as const;
export const BookingStatus = z.enum(BOOKING_STATUSES);
export type BookingStatus = z.infer<typeof BookingStatus>;

export const ACTIVE_BOOKING_STATUSES: readonly BookingStatus[] = [
  'searching',
  'accepted',
  'en_route',
  'arrived',
  'quote_pending',
  'in_progress',
  'awaiting_code',
];

export const TERMINAL_BOOKING_STATUSES: readonly BookingStatus[] = [
  'closed',
  'cancelled_by_client',
  'cancelled_by_artisan',
  'expired',
];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending_payment: 'Paiement en attente',
  searching: "Recherche d'un artisan",
  accepted: 'Acceptée',
  en_route: 'Artisan en route',
  arrived: 'Artisan arrivé',
  quote_pending: 'Devis à valider',
  in_progress: 'Travaux en cours',
  awaiting_code: 'En attente du code de fin',
  closed: 'Terminée',
  cancelled_by_client: 'Annulée par vous',
  cancelled_by_artisan: "Annulée par l'artisan",
  expired: 'Aucun artisan disponible',
  disputed: 'Litige en cours',
};

export const ARTISAN_STATUSES = ['draft', 'pending_review', 'approved', 'rejected', 'suspended'] as const;
export const ArtisanStatus = z.enum(ARTISAN_STATUSES);
export type ArtisanStatus = z.infer<typeof ArtisanStatus>;

export const DOCUMENT_TYPES = ['identity', 'insurance_decennale', 'insurance_rc_pro', 'qualification'] as const;
export const DocumentType = z.enum(DOCUMENT_TYPES);
export type DocumentType = z.infer<typeof DocumentType>;

export const DOCUMENT_STATUSES = ['pending', 'approved', 'rejected', 'expired'] as const;
export const DocumentStatus = z.enum(DOCUMENT_STATUSES);
export type DocumentStatus = z.infer<typeof DocumentStatus>;

export const QUALIFICATION_BADGES = ['RGE', 'Qualigaz', 'Qualifelec'] as const;
export const QualificationBadge = z.enum(QUALIFICATION_BADGES);
export type QualificationBadge = z.infer<typeof QualificationBadge>;

export const DISPUTE_REASONS = ['never_came', 'travel_only', 'poor_quality', 'overcharged', 'other'] as const;
export const DisputeReason = z.enum(DISPUTE_REASONS);
export type DisputeReason = z.infer<typeof DisputeReason>;

export const DISPUTE_REASON_LABELS: Record<DisputeReason, string> = {
  never_came: 'Technicien jamais venu',
  travel_only: 'Déplacement seulement',
  poor_quality: 'Travail mal fait',
  overcharged: 'Montant non conforme',
  other: 'Autre',
};

export const DISPUTE_STATUSES = ['open', 'resolved'] as const;
export const DisputeStatus = z.enum(DISPUTE_STATUSES);
export type DisputeStatus = z.infer<typeof DisputeStatus>;

export const DISPUTE_RESOLUTIONS = ['full_capture', 'partial_capture', 'travel_fee_only', 'full_refund'] as const;
export const DisputeResolution = z.enum(DISPUTE_RESOLUTIONS);
export type DisputeResolution = z.infer<typeof DisputeResolution>;

export const PAYMENT_STATUSES = [
  'requires_action',
  'authorized',
  'captured',
  'partially_captured',
  'cancelled',
  'refunded',
  'failed',
] as const;
export const PaymentStatus = z.enum(PAYMENT_STATUSES);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const QUOTE_STATUSES = ['sent', 'accepted', 'refused', 'expired'] as const;
export const QuoteStatus = z.enum(QUOTE_STATUSES);
export type QuoteStatus = z.infer<typeof QuoteStatus>;

export const QUOTE_LINE_KINDS = ['labor', 'part', 'travel'] as const;
export const QuoteLineKind = z.enum(QUOTE_LINE_KINDS);
export type QuoteLineKind = z.infer<typeof QuoteLineKind>;

export const NOTIFICATION_TYPES = [
  'booking_created',
  'booking_accepted',
  'booking_status',
  'booking_cancelled',
  'booking_expired',
  'urgent_offer',
  'quote_received',
  'quote_answered',
  'message',
  'review_received',
  'reminder',
  'artisan_approved',
  'artisan_rejected',
  'document_expiring',
  'payout',
] as const;
export const NotificationType = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof NotificationType>;

export const FILE_PURPOSES = ['avatar', 'problem_photo', 'problem_voice', 'report_before', 'report_after', 'chat', 'document', 'portfolio', 'review'] as const;
export const FilePurpose = z.enum(FILE_PURPOSES);
export type FilePurpose = z.infer<typeof FilePurpose>;

export const DISPATCH_OFFER_STATUSES = ['pending', 'accepted', 'declined', 'expired', 'taken'] as const;
export const DispatchOfferStatus = z.enum(DISPATCH_OFFER_STATUSES);
export type DispatchOfferStatus = z.infer<typeof DispatchOfferStatus>;

export const CANCEL_ACTORS = ['client', 'artisan', 'system', 'support'] as const;
export type Actor = (typeof CANCEL_ACTORS)[number];
