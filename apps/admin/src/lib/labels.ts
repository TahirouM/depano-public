import {
  BOOKING_STATUS_LABELS,
  type ArtisanStatus,
  type BookingStatus,
  type DispatchOfferStatus,
  type DisputeResolution,
  type DocumentStatus,
  type DocumentType,
  type KycChecklistDto,
  type PaymentStatus,
  type QuoteLineKind,
  type QuoteStatus,
  type Role,
} from '@depano/schemas';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'urgent' | 'brand';

/** Libellés de statut vus côté back-office (le libellé partagé est rédigé pour le client). */
export const ADMIN_BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  ...BOOKING_STATUS_LABELS,
  cancelled_by_client: 'Annulée par le client',
};

export const BOOKING_STATUS_TONES: Record<BookingStatus, Tone> = {
  pending_payment: 'neutral',
  requested: 'warning',
  searching: 'info',
  accepted: 'info',
  en_route: 'info',
  arrived: 'info',
  quote_pending: 'warning',
  in_progress: 'info',
  awaiting_code: 'warning',
  closed: 'success',
  cancelled_by_client: 'neutral',
  cancelled_by_artisan: 'neutral',
  expired: 'neutral',
  disputed: 'urgent',
};

export const ARTISAN_STATUS_LABELS: Record<ArtisanStatus, string> = {
  draft: 'Brouillon',
  pending_review: 'À valider',
  approved: 'Validé',
  rejected: 'Refusé',
  suspended: 'Suspendu',
};

export const ARTISAN_STATUS_TONES: Record<ArtisanStatus, Tone> = {
  draft: 'neutral',
  pending_review: 'warning',
  approved: 'success',
  rejected: 'urgent',
  suspended: 'urgent',
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  identity: "Pièce d'identité",
  insurance_decennale: 'Assurance décennale',
  insurance_rc_pro: 'RC professionnelle',
  qualification: 'Qualification',
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  pending: 'À vérifier',
  approved: 'Validé',
  rejected: 'Refusé',
  expired: 'Expiré',
};

export const DOCUMENT_STATUS_TONES: Record<DocumentStatus, Tone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'urgent',
  expired: 'urgent',
};

export const KYC_LABELS: Record<keyof KycChecklistDto, string> = {
  siret: 'SIRET vérifié (entreprise active)',
  domains: 'Métiers renseignés',
  services: 'Prestations et tarifs',
  zone: "Zone d'intervention",
  availability: 'Horaires types',
  identity: "Pièce d'identité",
  insurance: 'Assurances (décennale, RC pro)',
  payouts: 'Compte de paiement (Stripe Connect)',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  requires_action: 'Action requise',
  authorized: 'Empreinte autorisée',
  captured: 'Capturé',
  partially_captured: 'Capturé partiellement',
  cancelled: 'Annulé',
  refunded: 'Remboursé',
  failed: 'Échec',
};

export const PAYMENT_STATUS_TONES: Record<PaymentStatus, Tone> = {
  requires_action: 'warning',
  authorized: 'info',
  captured: 'success',
  partially_captured: 'success',
  cancelled: 'neutral',
  refunded: 'neutral',
  failed: 'urgent',
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  sent: 'Envoyé',
  accepted: 'Accepté',
  refused: 'Refusé',
  expired: 'Expiré',
};

export const QUOTE_LINE_KIND_LABELS: Record<QuoteLineKind, string> = {
  labor: "Main-d'œuvre",
  part: 'Pièce',
  travel: 'Déplacement',
};

export const OFFER_STATUS_LABELS: Record<DispatchOfferStatus, string> = {
  pending: 'En attente',
  accepted: 'Acceptée',
  declined: 'Refusée',
  expired: 'Expirée (60 s)',
  taken: 'Prise par un autre',
};

export const OFFER_STATUS_TONES: Record<DispatchOfferStatus, Tone> = {
  pending: 'info',
  accepted: 'success',
  declined: 'neutral',
  expired: 'warning',
  taken: 'neutral',
};

export const RESOLUTION_LABELS: Record<DisputeResolution, string> = {
  full_capture: 'Capture totale (artisan payé)',
  partial_capture: 'Capture partielle',
  travel_fee_only: 'Frais de déplacement seuls',
  full_refund: 'Remboursement intégral',
};

export const ROLE_LABELS: Record<Role, string> = {
  client: 'Client',
  artisan: 'Artisan',
  support: 'Support',
  admin: 'Admin',
};

export const ACTOR_LABELS = {
  client: 'Client',
  artisan: 'Artisan',
  system: 'Système',
  support: 'Support',
} as const;

export const SERVICE_KIND_LABELS = {
  maintenance: 'Entretien',
  repair: 'Dépannage',
  both: 'Entretien et dépannage',
} as const;
