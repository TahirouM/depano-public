import { z } from 'zod';
import {
  ArtisanStatus,
  BookingKind,
  BookingStatus,
  DispatchOfferStatus,
  DisputeReason,
  DisputeResolution,
  DisputeStatus,
  DocumentStatus,
  DocumentType,
  DomainCode,
  FilePurpose,
  NotificationType,
  PaymentStatus,
  QualificationBadge,
  QuoteLineKind,
  QuoteStatus,
  Role,
  ScheduledType,
} from './enums';
import type { PriceBreakdown } from './rules';

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

/** Téléphone au format E.164, normalisé pour la France si saisi en 06… */
export const Phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s.-]/g, ''))
  .transform((v) => (/^0[1-9]\d{8}$/.test(v) ? `+33${v.slice(1)}` : v))
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, 'Numéro de téléphone invalide'));

export const Uuid = z.string().uuid();
export const Cents = z.number().int().nonnegative();
export const Latitude = z.number().min(-90).max(90);
export const Longitude = z.number().min(-180).max(180);
export const IsoDateTime = z.string().datetime({ offset: true });
export const Siret = z
  .string()
  .transform((v) => v.replace(/\s/g, ''))
  .pipe(z.string().regex(/^\d{14}$/, 'Le SIRET contient 14 chiffres'));

export const GeoPoint = z.object({ lat: Latitude, lng: Longitude });
export type GeoPoint = z.infer<typeof GeoPoint>;

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export const OtpRequestBody = z.object({ phone: Phone });
export type OtpRequestBody = z.infer<typeof OtpRequestBody>;

export const OtpVerifyBody = z.object({
  phone: Phone,
  code: z.string().regex(/^\d{6}$/, 'Le code contient 6 chiffres'),
  deviceName: z.string().max(100).optional(),
});
export type OtpVerifyBody = z.infer<typeof OtpVerifyBody>;

export const AppleSignInBody = z.object({
  identityToken: z.string().min(10),
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  deviceName: z.string().max(100).optional(),
});
export type AppleSignInBody = z.infer<typeof AppleSignInBody>;

export const GoogleSignInBody = z.object({
  idToken: z.string().min(10),
  deviceName: z.string().max(100).optional(),
});
export type GoogleSignInBody = z.infer<typeof GoogleSignInBody>;

export const RefreshBody = z.object({ refreshToken: z.string().min(20) });
export type RefreshBody = z.infer<typeof RefreshBody>;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Durée de vie du jeton d'accès, en secondes. */
  expiresIn: number;
}

export interface AuthResult extends AuthTokens {
  user: Me;
  isNewUser: boolean;
}

export interface SessionDto {
  id: string;
  deviceName: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

export const PasskeyRegisterVerifyBody = z.object({ response: z.record(z.string(), z.unknown()) });
export const PasskeyLoginOptionsBody = z.object({ phone: Phone.optional() });
export const PasskeyLoginVerifyBody = z.object({
  challengeId: z.string(),
  response: z.record(z.string(), z.unknown()),
  deviceName: z.string().max(100).optional(),
});

/* ------------------------------------------------------------------ */
/* Utilisateur                                                         */
/* ------------------------------------------------------------------ */

export interface Me {
  id: string;
  phone: string | null;
  phoneVerified: boolean;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  roles: Role[];
  activeRole: 'client' | 'artisan';
  artisan: {
    id: string;
    status: ArtisanStatus;
    urgentAvailable: boolean;
  } | null;
  createdAt: string;
}

export const UpdateMeBody = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  email: z.string().email().optional().nullable(),
  avatarFileId: Uuid.optional().nullable(),
});
export type UpdateMeBody = z.infer<typeof UpdateMeBody>;

export const SetActiveRoleBody = z.object({ role: z.enum(['client', 'artisan']) });
export type SetActiveRoleBody = z.infer<typeof SetActiveRoleBody>;

export const PushTokenBody = z.object({
  token: z.string().min(10),
  platform: z.enum(['ios', 'android']),
});
export type PushTokenBody = z.infer<typeof PushTokenBody>;

export const AddressBody = z.object({
  label: z.string().max(40).default('Domicile'),
  line1: z.string().min(3).max(200),
  postalCode: z.string().regex(/^\d{5}$/),
  city: z.string().min(1).max(100),
  floor: z.string().max(20).optional().nullable(),
  doorCode: z.string().max(20).optional().nullable(),
  accessNotes: z.string().max(500).optional().nullable(),
  lat: Latitude,
  lng: Longitude,
  isDefault: z.boolean().default(false),
});
export type AddressBody = z.infer<typeof AddressBody>;

export interface AddressDto extends Omit<AddressBody, 'isDefault'> {
  id: string;
  isDefault: boolean;
}

export interface AddressSuggestion {
  label: string;
  line1: string;
  postalCode: string;
  city: string;
  lat: number;
  lng: number;
}

export interface PaymentMethodDto {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

export interface SetupIntentDto {
  provider: 'stripe' | 'fake';
  clientSecret: string;
  customerId: string;
  ephemeralKey: string | null;
}

/* ------------------------------------------------------------------ */
/* Catalogue et artisans                                               */
/* ------------------------------------------------------------------ */

export interface ServiceDto {
  id: string;
  domain: DomainCode;
  slug: string;
  name: string;
  description: string | null;
  kind: 'maintenance' | 'repair' | 'both';
  urgentEligible: boolean;
  /** Prix indicatif du marché, proposé par défaut aux artisans. */
  referencePriceCents: number;
  defaultDurationMinutes: number;
}

export interface DomainDto {
  code: DomainCode;
  name: string;
  icon: string;
  services: ServiceDto[];
}

export const ArtisanSearchQuery = z.object({
  domain: DomainCode.optional(),
  q: z.string().max(100).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(1).max(50).default(20),
  availableToday: z.coerce.boolean().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  maxPriceCents: z.coerce.number().int().optional(),
  sort: z.enum(['relevance', 'distance', 'rating', 'price']).default('relevance'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ArtisanSearchQuery = z.infer<typeof ArtisanSearchQuery>;

export interface ArtisanCardDto {
  id: string;
  displayName: string;
  companyName: string;
  avatarUrl: string | null;
  domains: DomainCode[];
  ratingAvg: number | null;
  ratingCount: number;
  distanceKm: number | null;
  fromPriceCents: number | null;
  urgentAvailable: boolean;
  nextSlotAt: string | null;
  badges: { siretVerified: boolean; insured: boolean; qualifications: QualificationBadge[] };
}

export interface ArtisanServiceDto {
  serviceId: string;
  name: string;
  domain: DomainCode;
  priceCents: number;
  durationMinutes: number;
}

export interface ReviewDto {
  id: string;
  bookingId: string;
  rating: number;
  tags: string[];
  comment: string | null;
  photoUrls: string[];
  authorFirstName: string;
  createdAt: string;
  reply: { body: string; createdAt: string } | null;
}

export interface ArtisanPublicDto extends ArtisanCardDto {
  bio: string | null;
  city: string | null;
  radiusKm: number;
  travelFeeCents: number;
  services: ArtisanServiceDto[];
  portfolioUrls: string[];
  recentReviews: ReviewDto[];
  memberSince: string;
  completedCount: number;
  acceptanceRate: number | null;
}

export const SlotsQuery = z.object({
  serviceId: Uuid.optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  days: z.coerce.number().int().min(1).max(30).default(14),
});
export type SlotsQuery = z.infer<typeof SlotsQuery>;

export interface SlotDay {
  date: string; // YYYY-MM-DD, Europe/Paris
  slots: string[]; // ISO datetimes de début
}

export const EstimateBody = z.object({
  domain: DomainCode,
  serviceId: Uuid.optional(),
  artisanId: Uuid.optional(),
  lat: Latitude.optional(),
  lng: Longitude.optional(),
  urgent: z.boolean(),
  withGuarantee: z.boolean().default(false),
});
export type EstimateBody = z.infer<typeof EstimateBody>;

export interface EstimateDto {
  price: PriceBreakdown;
  availableArtisans: number;
  inZone: boolean;
  etaMinutes: number | null;
}

/* ------------------------------------------------------------------ */
/* Réservations / interventions                                        */
/* ------------------------------------------------------------------ */

export const InlineAddress = AddressBody.omit({ isDefault: true, label: true }).extend({
  saveAs: z.string().max(40).optional(),
});

export const CreateBookingBody = z
  .object({
    kind: BookingKind,
    domain: DomainCode,
    serviceId: Uuid.optional(),
    scheduledType: ScheduledType.optional(),
    artisanId: Uuid.optional(),
    scheduledAt: IsoDateTime.optional(),
    addressId: Uuid.optional(),
    address: InlineAddress.optional(),
    problemReason: z.string().max(120),
    problemDescription: z.string().max(2000).optional(),
    problemFileIds: z.array(Uuid).max(6).default([]),
    withGuarantee: z.boolean().default(false),
    /** Urgence : renonciation expresse au droit de rétractation. */
    waivesWithdrawal: z.boolean().default(false),
    paymentMethodId: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.addressId && !v.address) ctx.addIssue({ code: 'custom', message: 'Adresse requise', path: ['address'] });
    if (v.kind === 'scheduled') {
      if (!v.artisanId) ctx.addIssue({ code: 'custom', message: 'Artisan requis', path: ['artisanId'] });
      if (!v.scheduledAt) ctx.addIssue({ code: 'custom', message: 'Créneau requis', path: ['scheduledAt'] });
    }
    if (v.kind === 'urgent' && !v.waivesWithdrawal) {
      ctx.addIssue({
        code: 'custom',
        message: 'Vous devez demander expressément une intervention immédiate',
        path: ['waivesWithdrawal'],
      });
    }
  });
export type CreateBookingBody = z.infer<typeof CreateBookingBody>;

export interface PaymentSessionDto {
  provider: 'stripe' | 'fake';
  paymentIntentId: string | null;
  setupIntentId: string | null;
  clientSecret: string;
  customerId: string | null;
  ephemeralKey: string | null;
  amountCents: number;
}

export interface CreateBookingResult {
  booking: BookingDetailDto;
  payment: PaymentSessionDto;
}

export const BookingListQuery = z.object({
  as: z.enum(['client', 'artisan']).default('client'),
  scope: z.enum(['active', 'past', 'all']).default('all'),
  from: IsoDateTime.optional(),
  to: IsoDateTime.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type BookingListQuery = z.infer<typeof BookingListQuery>;

export interface BookingEventDto {
  id: string;
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus;
  actor: 'client' | 'artisan' | 'system' | 'support';
  note: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: string;
}

export interface QuoteLineDto {
  id: string;
  kind: QuoteLineKind;
  label: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface QuoteDto {
  id: string;
  status: QuoteStatus;
  lines: QuoteLineDto[];
  totalCents: number;
  needsNewAuthorization: boolean;
  keepReplacedParts: boolean;
  expiresAt: string;
  createdAt: string;
  answeredAt: string | null;
}

export interface ReportDto {
  feasible: boolean;
  materials: string | null;
  notes: string | null;
  voiceTranscript: string | null;
  followUpNeeded: boolean;
  beforePhotoUrls: string[];
  afterPhotoUrls: string[];
  createdAt: string;
}

export interface BookingSummaryDto {
  id: string;
  reference: string;
  kind: BookingKind;
  status: BookingStatus;
  domain: DomainCode;
  serviceName: string | null;
  problemReason: string;
  scheduledAt: string | null;
  createdAt: string;
  totalCents: number;
  city: string;
  counterpart: { id: string; name: string; avatarUrl: string | null } | null;
  unreadMessages: number;
}

export interface BookingDetailDto extends BookingSummaryDto {
  scheduledType: ScheduledType | null;
  problemDescription: string | null;
  problemPhotoUrls: string[];
  /** Adresse complète : visible par l'artisan seulement à partir de « accepted ». */
  address: {
    line1: string | null;
    postalCode: string;
    city: string;
    floor: string | null;
    doorCode: string | null;
    accessNotes: string | null;
    lat: number | null;
    lng: number | null;
    /** Position approximative (au quartier), toujours visible. */
    approxLat: number;
    approxLng: number;
  };
  price: PriceBreakdown;
  authorizedCents: number;
  capturedCents: number | null;
  commissionCents: number | null;
  withGuarantee: boolean;
  artisan: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    ratingAvg: number | null;
    phoneMasked: string | null;
  } | null;
  client: { id: string; firstName: string; avatarUrl: string | null } | null;
  etaMinutes: number | null;
  artisanLocation: GeoPoint | null;
  /** Code de fin à 4 chiffres : visible uniquement par le client. */
  completionCode: string | null;
  completionAttemptsLeft: number;
  events: BookingEventDto[];
  quote: QuoteDto | null;
  report: ReportDto | null;
  review: ReviewDto | null;
  dispute: DisputeDto | null;
  conversationId: string | null;
  invoiceId: string | null;
  dispatch: { wave: number; contacted: number; radiusKm: number } | null;
  /** Transitions disponibles pour l'appelant. */
  allowedTransitions: BookingStatus[];
  canReview: boolean;
  cancellationIsFree: boolean;
  cancellationFeeCents: number;
}

export const TransitionBody = z.object({
  to: BookingStatus,
  lat: Latitude.optional(),
  lng: Longitude.optional(),
  note: z.string().max(500).optional(),
});
export type TransitionBody = z.infer<typeof TransitionBody>;

export const CancelBookingBody = z.object({ reason: z.string().max(500).optional() });
export type CancelBookingBody = z.infer<typeof CancelBookingBody>;

export const QuoteLineBody = z.object({
  kind: QuoteLineKind,
  label: z.string().min(1).max(200),
  quantity: z.number().positive().max(1000),
  unitPriceCents: Cents,
});
export const CreateQuoteBody = z.object({
  lines: z.array(QuoteLineBody).min(1).max(30),
  keepReplacedParts: z.boolean().default(true),
});
export type CreateQuoteBody = z.infer<typeof CreateQuoteBody>;

export const AnswerQuoteBody = z.object({ accept: z.boolean() });
export type AnswerQuoteBody = z.infer<typeof AnswerQuoteBody>;

export const ReportBody = z.object({
  feasible: z.boolean(),
  materials: z.string().max(2000).optional(),
  notes: z.string().max(4000).optional(),
  voiceFileId: Uuid.optional(),
  followUpNeeded: z.boolean().default(false),
  beforeFileIds: z.array(Uuid).max(10).default([]),
  afterFileIds: z.array(Uuid).max(10).default([]),
  /** « Déplacement seulement » : aucun travail réalisé, seuls les frais de déplacement sont dus. */
  travelOnly: z.boolean().default(false),
});
export type ReportBody = z.infer<typeof ReportBody>;

export const CompleteBody = z.object({ code: z.string().regex(/^\d{4}$/) });
export type CompleteBody = z.infer<typeof CompleteBody>;

export const LocationBody = z.object({
  lat: Latitude,
  lng: Longitude,
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).optional(),
});
export type LocationBody = z.infer<typeof LocationBody>;

export const ReviewBody = z.object({
  rating: z.number().int().min(1).max(5),
  tags: z.array(z.string().max(40)).max(8).default([]),
  comment: z.string().max(2000).optional(),
  photoFileIds: z.array(Uuid).max(4).default([]),
});
export type ReviewBody = z.infer<typeof ReviewBody>;

export const ReviewReplyBody = z.object({ body: z.string().min(1).max(2000) });

export const DisputeBody = z.object({
  reason: DisputeReason,
  description: z.string().max(4000).optional(),
});
export type DisputeBody = z.infer<typeof DisputeBody>;

export interface DisputeDto {
  id: string;
  reason: DisputeReason;
  description: string | null;
  status: DisputeStatus;
  resolution: DisputeResolution | null;
  resolutionNote: string | null;
  refundedCents: number | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CallRelayDto {
  /** Numéro relais à composer (masque le vrai numéro). */
  phoneNumber: string;
  expiresAt: string;
}

/* ------------------------------------------------------------------ */
/* Dispatch urgence (côté artisan)                                     */
/* ------------------------------------------------------------------ */

export interface UrgentOfferDto {
  id: string;
  bookingId: string;
  status: DispatchOfferStatus;
  domain: DomainCode;
  problemReason: string;
  problemDescription: string | null;
  problemPhotoUrls: string[];
  distanceKm: number;
  city: string;
  /** Montant net estimé pour l'artisan (après commission). */
  estimatedEarningsCents: number;
  totalCents: number;
  expiresAt: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Espace artisan                                                      */
/* ------------------------------------------------------------------ */

export const SiretLookupBody = z.object({ siret: Siret });
export type SiretLookupBody = z.infer<typeof SiretLookupBody>;

export interface CompanyInfoDto {
  siret: string;
  siren: string;
  name: string;
  address: string;
  postalCode: string | null;
  city: string | null;
  apeCode: string | null;
  apeLabel: string | null;
  active: boolean;
  /** Métiers suggérés à partir du code APE. */
  suggestedDomains: DomainCode[];
  apeMatchesTrade: boolean;
}

export const ArtisanProfileBody = z.object({
  displayName: z.string().min(2).max(80).optional(),
  bio: z.string().max(2000).optional().nullable(),
  domains: z.array(DomainCode).min(1).optional(),
  baseLat: Latitude.optional(),
  baseLng: Longitude.optional(),
  baseCity: z.string().max(100).optional(),
  radiusKm: z.number().int().min(1).max(50).optional(),
  travelFeeCents: Cents.optional(),
  qualifications: z.array(QualificationBadge).optional(),
  portfolioFileIds: z.array(Uuid).max(20).optional(),
});
export type ArtisanProfileBody = z.infer<typeof ArtisanProfileBody>;

export const ArtisanServicesBody = z.object({
  services: z
    .array(
      z.object({
        serviceId: Uuid,
        priceCents: Cents,
        durationMinutes: z.number().int().min(15).max(600),
      }),
    )
    .max(100),
});
export type ArtisanServicesBody = z.infer<typeof ArtisanServicesBody>;

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const AvailabilityRulesBody = z.object({
  rules: z
    .array(z.object({ weekday: z.number().int().min(0).max(6), start: HHMM, end: HHMM }))
    .max(50),
});
export type AvailabilityRulesBody = z.infer<typeof AvailabilityRulesBody>;

export const AvailabilityExceptionBody = z.object({
  startsAt: IsoDateTime,
  endsAt: IsoDateTime,
  reason: z.string().max(200).optional(),
});
export type AvailabilityExceptionBody = z.infer<typeof AvailabilityExceptionBody>;

export interface AvailabilityExceptionDto {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}

export const ArtisanDocumentBody = z.object({
  type: DocumentType,
  fileId: Uuid,
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  label: z.string().max(100).optional(),
});
export type ArtisanDocumentBody = z.infer<typeof ArtisanDocumentBody>;

export interface ArtisanDocumentDto {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  label: string | null;
  expiresAt: string | null;
  rejectionReason: string | null;
  fileUrl: string;
  createdAt: string;
}

export interface KycChecklistDto {
  siret: boolean;
  domains: boolean;
  services: boolean;
  zone: boolean;
  availability: boolean;
  identity: boolean;
  insurance: boolean;
  payouts: boolean;
}

export interface ArtisanPrivateProfileDto {
  id: string;
  status: ArtisanStatus;
  rejectionReason: string | null;
  siret: string | null;
  companyName: string | null;
  companyAddress: string | null;
  apeCode: string | null;
  displayName: string;
  bio: string | null;
  domains: DomainCode[];
  baseLat: number | null;
  baseLng: number | null;
  baseCity: string | null;
  radiusKm: number;
  travelFeeCents: number;
  qualifications: QualificationBadge[];
  urgentAvailable: boolean;
  reliabilityScore: number;
  stripeAccountId: string | null;
  payoutsEnabled: boolean;
  services: ArtisanServiceDto[];
  availabilityRules: { weekday: number; start: string; end: string }[];
  documents: ArtisanDocumentDto[];
  portfolioUrls: string[];
  checklist: KycChecklistDto;
  submittedAt: string | null;
  approvedAt: string | null;
}

export const UrgentAvailabilityBody = z.object({
  available: z.boolean(),
  lat: Latitude.optional(),
  lng: Longitude.optional(),
});
export type UrgentAvailabilityBody = z.infer<typeof UrgentAvailabilityBody>;

export interface ArtisanDashboardDto {
  today: { count: number; earningsCents: number; completed: number };
  next: BookingSummaryDto | null;
  pendingOffers: UrgentOfferDto[];
  upcoming: BookingSummaryDto[];
  urgentAvailable: boolean;
  status: ArtisanStatus;
}

export const PlanningQuery = z.object({ from: IsoDateTime, to: IsoDateTime });
export interface PlanningDto {
  bookings: BookingSummaryDto[];
  exceptions: AvailabilityExceptionDto[];
  rules: { weekday: number; start: string; end: string }[];
}

export interface EarningsDto {
  availableCents: number;
  pendingCents: number;
  lifetimeCents: number;
  commissionLifetimeCents: number;
  payouts: { id: string; amountCents: number; status: string; arrivalDate: string | null }[];
  lines: {
    bookingId: string;
    reference: string;
    date: string;
    grossCents: number;
    commissionCents: number;
    netCents: number;
  }[];
}

export interface ArtisanStatsDto {
  monthly: { month: string; revenueCents: number; count: number }[];
  acceptanceRate: number | null;
  ratingAvg: number | null;
  ratingCount: number;
  cancellations30d: number;
  completedCount: number;
}

/* ------------------------------------------------------------------ */
/* Fichiers                                                            */
/* ------------------------------------------------------------------ */

export const UploadUrlBody = z.object({
  purpose: FilePurpose,
  contentType: z.string().regex(/^(image\/(jpeg|png|webp|heic)|audio\/(m4a|mp4|mpeg|aac|x-m4a)|application\/pdf)$/),
  sizeBytes: z.number().int().positive().max(15 * 1024 * 1024),
});
export type UploadUrlBody = z.infer<typeof UploadUrlBody>;

export interface UploadUrlDto {
  fileId: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
}

/* ------------------------------------------------------------------ */
/* Messagerie                                                          */
/* ------------------------------------------------------------------ */

export interface ConversationDto {
  id: string;
  bookingId: string;
  bookingReference: string;
  bookingStatus: BookingStatus;
  domain: DomainCode;
  counterpart: { id: string; name: string; avatarUrl: string | null };
  lastMessage: MessageDto | null;
  unreadCount: number;
  updatedAt: string;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string | null;
  kind: 'text' | 'image' | 'voice' | 'system';
  body: string | null;
  fileUrl: string | null;
  /** Identifiant généré côté app pour l'optimistic UI et l'idempotence. */
  clientId: string | null;
  createdAt: string;
  readAt: string | null;
}

export const SendMessageBody = z
  .object({
    clientId: z.string().min(8).max(64),
    kind: z.enum(['text', 'image', 'voice']).default('text'),
    body: z.string().max(4000).optional(),
    fileId: Uuid.optional(),
  })
  .refine((v) => (v.kind === 'text' ? !!v.body?.trim() : !!v.fileId), 'Message vide');
export type SendMessageBody = z.infer<typeof SendMessageBody>;

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Lien profond, ex. depano://intervention/{id} */
  link: string | null;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface BadgesDto {
  notifications: number;
  messages: number;
  activity: number;
}

/* ------------------------------------------------------------------ */
/* Factures                                                            */
/* ------------------------------------------------------------------ */

export interface InvoiceDto {
  id: string;
  number: string;
  bookingId: string;
  kind: 'service' | 'commission';
  totalCents: number;
  issuedAt: string;
  pdfUrl: string | null;
}

/* ------------------------------------------------------------------ */
/* Back-office                                                         */
/* ------------------------------------------------------------------ */

export const AdminArtisanListQuery = z.object({
  status: z.enum(['draft', 'pending_review', 'approved', 'rejected', 'suspended']).optional(),
  q: z.string().max(100).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export interface AdminArtisanRowDto {
  id: string;
  userId: string;
  displayName: string;
  companyName: string | null;
  siret: string | null;
  phone: string | null;
  status: ArtisanStatus;
  domains: DomainCode[];
  city: string | null;
  ratingAvg: number | null;
  completedCount: number;
  submittedAt: string | null;
  createdAt: string;
}

export interface AdminArtisanDetailDto extends ArtisanPrivateProfileDto {
  userId: string;
  phone: string | null;
  email: string | null;
  companyActive: boolean | null;
  cancellations30d: number;
  recentBookings: BookingSummaryDto[];
}

export const AdminDecisionBody = z.object({ reason: z.string().max(1000).optional() });
export type AdminDecisionBody = z.infer<typeof AdminDecisionBody>;

export const AdminBookingListQuery = z.object({
  status: BookingStatus.optional(),
  kind: BookingKind.optional(),
  q: z.string().max(100).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export interface AdminBookingDetailDto extends BookingDetailDto {
  clientPhone: string | null;
  artisanPhone: string | null;
  locations: { lat: number; lng: number; at: string }[];
  messages: MessageDto[];
  payments: {
    id: string;
    provider: string;
    providerRef: string | null;
    status: PaymentStatus;
    amountCents: number;
    capturedCents: number | null;
    createdAt: string;
  }[];
  dispatchOffers: { artisanId: string; artisanName: string; wave: number; status: DispatchOfferStatus; distanceKm: number; createdAt: string }[];
}

export interface AdminDisputeRowDto {
  id: string;
  bookingId: string;
  bookingReference: string;
  reason: DisputeReason;
  status: DisputeStatus;
  clientName: string;
  artisanName: string | null;
  amountCents: number;
  createdAt: string;
  /** Échéance de traitement (72 h). */
  dueAt: string;
}

export const ResolveDisputeBody = z.object({
  resolution: DisputeResolution,
  /** Montant capturé pour une capture partielle. */
  captureCents: Cents.optional(),
  note: z.string().min(3).max(2000),
});
export type ResolveDisputeBody = z.infer<typeof ResolveDisputeBody>;

export const AdminServiceBody = z.object({
  domain: DomainCode,
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional().nullable(),
  kind: z.enum(['maintenance', 'repair', 'both']),
  urgentEligible: z.boolean(),
  referencePriceCents: Cents,
  defaultDurationMinutes: z.number().int().min(15).max(600),
  active: z.boolean().default(true),
});
export type AdminServiceBody = z.infer<typeof AdminServiceBody>;

export interface ZoneDto {
  id: string;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  commissionRate: number;
  active: boolean;
}

export const ZoneBody = z.object({
  name: z.string().min(2).max(80),
  centerLat: Latitude,
  centerLng: Longitude,
  radiusKm: z.number().min(1).max(100),
  commissionRate: z.number().min(0).max(0.5),
  active: z.boolean().default(true),
});
export type ZoneBody = z.infer<typeof ZoneBody>;

export interface AdminMetricsDto {
  period: { from: string; to: string };
  urgentTakeRate: number | null;
  medianAcceptanceSeconds: number | null;
  urgentFunnelConversion: number | null;
  codeClosureRate: number | null;
  disputeRate: number | null;
  ratingAvg: number | null;
  clientRecurrence: number | null;
  bookingsPerActiveArtisanWeek: number | null;
  totals: {
    bookings: number;
    closed: number;
    gmvCents: number;
    commissionCents: number;
    activeArtisans: number;
    pendingArtisans: number;
    openDisputes: number;
  };
  daily: { date: string; bookings: number; gmvCents: number }[];
}

export interface AdminUserRowDto {
  id: string;
  phone: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  roles: Role[];
  createdAt: string;
  deletedAt: string | null;
  bookingsCount: number;
}
