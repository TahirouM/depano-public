import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  ARTISAN_STATUSES,
  BOOKING_KINDS,
  BOOKING_STATUSES,
  DISPATCH_OFFER_STATUSES,
  DISPUTE_REASONS,
  DISPUTE_RESOLUTIONS,
  DISPUTE_STATUSES,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  DOMAIN_CODES,
  FILE_PURPOSES,
  NOTIFICATION_TYPES,
  PAYMENT_STATUSES,
  QUOTE_LINE_KINDS,
  QUOTE_STATUSES,
  ROLES,
  SCHEDULED_TYPES,
} from '@depano/schemas';

/* ------------------------------------------------------------------ */
/* Types et helpers                                                    */
/* ------------------------------------------------------------------ */

/** geography(Point, 4326), toujours générée à partir des colonnes lat/lng. */
const geography = customType<{ data: string; driverData: string }>({
  dataType: () => 'geography(Point, 4326)',
});
const geoFrom = (lat: string, lng: string) =>
  sql.raw(`(CASE WHEN ${lat} IS NOT NULL AND ${lng} IS NOT NULL THEN ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography END)`);

const tstzrange = customType<{ data: string }>({ dataType: () => 'tstzrange' });

const id = () => uuid('id').primaryKey().defaultRandom();
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const timestamps = {
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const roleEnum = pgEnum('role', ROLES);
export const domainEnum = pgEnum('domain_code', DOMAIN_CODES);
export const bookingKindEnum = pgEnum('booking_kind', BOOKING_KINDS);
export const bookingStatusEnum = pgEnum('booking_status', BOOKING_STATUSES);
export const scheduledTypeEnum = pgEnum('scheduled_type', SCHEDULED_TYPES);
export const artisanStatusEnum = pgEnum('artisan_status', ARTISAN_STATUSES);
export const documentTypeEnum = pgEnum('document_type', DOCUMENT_TYPES);
export const documentStatusEnum = pgEnum('document_status', DOCUMENT_STATUSES);
export const disputeReasonEnum = pgEnum('dispute_reason', DISPUTE_REASONS);
export const disputeStatusEnum = pgEnum('dispute_status', DISPUTE_STATUSES);
export const disputeResolutionEnum = pgEnum('dispute_resolution', DISPUTE_RESOLUTIONS);
export const paymentStatusEnum = pgEnum('payment_status', PAYMENT_STATUSES);
export const quoteStatusEnum = pgEnum('quote_status', QUOTE_STATUSES);
export const quoteLineKindEnum = pgEnum('quote_line_kind', QUOTE_LINE_KINDS);
export const notificationTypeEnum = pgEnum('notification_type', NOTIFICATION_TYPES);
export const filePurposeEnum = pgEnum('file_purpose', FILE_PURPOSES);
export const offerStatusEnum = pgEnum('dispatch_offer_status', DISPATCH_OFFER_STATUSES);
export const actorEnum = pgEnum('actor', ['client', 'artisan', 'system', 'support']);
export const serviceKindEnum = pgEnum('service_kind', ['maintenance', 'repair', 'both']);
export const messageKindEnum = pgEnum('message_kind', ['text', 'image', 'voice', 'system']);
export const invoiceKindEnum = pgEnum('invoice_kind', ['service', 'commission']);

/* ------------------------------------------------------------------ */
/* Domaine 1 : identité et accès                                       */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  'users',
  {
    id: id(),
    phone: varchar('phone', { length: 20 }),
    phoneVerifiedAt: ts('phone_verified_at'),
    email: varchar('email', { length: 255 }),
    firstName: varchar('first_name', { length: 80 }),
    lastName: varchar('last_name', { length: 80 }),
    avatarFileId: uuid('avatar_file_id'),
    roles: roleEnum('roles').array().notNull().default(sql`ARRAY['client']::role[]`),
    activeRole: roleEnum('active_role').notNull().default('client'),
    appleSub: varchar('apple_sub', { length: 255 }),
    googleSub: varchar('google_sub', { length: 255 }),
    stripeCustomerId: varchar('stripe_customer_id', { length: 64 }),
    suspendedAt: ts('suspended_at'),
    deletedAt: ts('deleted_at'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('users_phone_uq').on(t.phone).where(sql`deleted_at IS NULL`),
    uniqueIndex('users_apple_uq').on(t.appleSub),
    uniqueIndex('users_google_uq').on(t.googleSub),
  ],
);

export const clientProfiles = pgTable('client_profiles', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  defaultAddressId: uuid('default_address_id'),
  referralCode: varchar('referral_code', { length: 16 }).unique(),
  referredByUserId: uuid('referred_by_user_id'),
  ...timestamps,
});

export const otpCodes = pgTable(
  'otp_codes',
  {
    id: id(),
    phone: varchar('phone', { length: 20 }).notNull(),
    codeHash: varchar('code_hash', { length: 128 }).notNull(),
    attempts: smallint('attempts').notNull().default(0),
    expiresAt: ts('expires_at').notNull(),
    consumedAt: ts('consumed_at'),
    ip: varchar('ip', { length: 64 }),
    ...timestamps,
  },
  (t) => [index('otp_phone_idx').on(t.phone, t.createdAt)],
);

/** Sessions = refresh tokens rotatifs, un par appareil ; révocables depuis « Appareils connectés ». */
export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: varchar('refresh_token_hash', { length: 128 }).notNull(),
    /** Famille de rotation : réutilisation d'un ancien jeton ⇒ révocation de toute la famille. */
    familyId: uuid('family_id').notNull(),
    deviceName: varchar('device_name', { length: 100 }),
    userAgent: text('user_agent'),
    ip: varchar('ip', { length: 64 }),
    lastUsedAt: ts('last_used_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
    revokedAt: ts('revoked_at'),
    ...timestamps,
  },
  (t) => [uniqueIndex('sessions_token_uq').on(t.refreshTokenHash), index('sessions_user_idx').on(t.userId)],
);

export const passkeys = pgTable('passkeys', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  credentialId: text('credential_id').notNull().unique(),
  publicKey: text('public_key').notNull(),
  counter: integer('counter').notNull().default(0),
  transports: text('transports').array(),
  deviceName: varchar('device_name', { length: 100 }),
  lastUsedAt: ts('last_used_at'),
  ...timestamps,
});

export const pushTokens = pgTable(
  'push_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    platform: varchar('platform', { length: 10 }).notNull(),
    disabledAt: ts('disabled_at'),
    ...timestamps,
  },
  (t) => [index('push_tokens_user_idx').on(t.userId)],
);

export const consents = pgTable('consents', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  kind: varchar('kind', { length: 40 }).notNull(), // cgu, cgv, marketing, analytics
  version: varchar('version', { length: 20 }).notNull(),
  granted: boolean('granted').notNull(),
  ...timestamps,
});

/* ------------------------------------------------------------------ */
/* Domaine 2 : catalogue, artisans, adresses                           */
/* ------------------------------------------------------------------ */

export const zones = pgTable('zones', {
  id: id(),
  name: varchar('name', { length: 80 }).notNull(),
  centerLat: doublePrecision('center_lat').notNull(),
  centerLng: doublePrecision('center_lng').notNull(),
  center: geography('center').generatedAlwaysAs(geoFrom('center_lat', 'center_lng')),
  radiusKm: real('radius_km').notNull(),
  commissionRate: real('commission_rate').notNull().default(0.15),
  active: boolean('active').notNull().default(true),
  ...timestamps,
});

export const domains = pgTable('domains', {
  code: domainEnum('code').primaryKey(),
  name: varchar('name', { length: 80 }).notNull(),
  icon: varchar('icon', { length: 40 }).notNull(),
  sortOrder: smallint('sort_order').notNull().default(0),
});

export const services = pgTable(
  'services',
  {
    id: id(),
    domain: domainEnum('domain')
      .notNull()
      .references(() => domains.code),
    slug: varchar('slug', { length: 80 }).notNull().unique(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    kind: serviceKindEnum('kind').notNull().default('both'),
    urgentEligible: boolean('urgent_eligible').notNull().default(true),
    referencePriceCents: integer('reference_price_cents').notNull(),
    defaultDurationMinutes: integer('default_duration_minutes').notNull().default(60),
    active: boolean('active').notNull().default(true),
    sortOrder: smallint('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('services_domain_idx').on(t.domain)],
);

export const artisanProfiles = pgTable(
  'artisan_profiles',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: artisanStatusEnum('status').notNull().default('draft'),
    rejectionReason: text('rejection_reason'),
    siret: varchar('siret', { length: 14 }).unique(),
    companyName: varchar('company_name', { length: 200 }),
    companyAddress: text('company_address'),
    apeCode: varchar('ape_code', { length: 10 }),
    companyActive: boolean('company_active'),
    displayName: varchar('display_name', { length: 80 }).notNull(),
    bio: text('bio'),
    domains: domainEnum('domains').array().notNull().default(sql`ARRAY[]::domain_code[]`),
    qualifications: text('qualifications').array().notNull().default(sql`ARRAY[]::text[]`),
    baseLat: doublePrecision('base_lat'),
    baseLng: doublePrecision('base_lng'),
    baseLocation: geography('base_location').generatedAlwaysAs(geoFrom('base_lat', 'base_lng')),
    baseCity: varchar('base_city', { length: 100 }),
    radiusKm: smallint('radius_km').notNull().default(15),
    travelFeeCents: integer('travel_fee_cents').notNull().default(2500),
    portfolioFileIds: uuid('portfolio_file_ids').array().notNull().default(sql`ARRAY[]::uuid[]`),
    /** Disponible pour les urgences + dernière position connue. */
    urgentAvailable: boolean('urgent_available').notNull().default(false),
    currentLat: doublePrecision('current_lat'),
    currentLng: doublePrecision('current_lng'),
    currentLocation: geography('current_location').generatedAlwaysAs(geoFrom('current_lat', 'current_lng')),
    currentLocationAt: ts('current_location_at'),
    /** Agrégats dénormalisés (mis à jour à chaque avis / clôture / offre). */
    ratingAvg: real('rating_avg'),
    ratingCount: integer('rating_count').notNull().default(0),
    completedCount: integer('completed_count').notNull().default(0),
    offersReceived: integer('offers_received').notNull().default(0),
    offersAccepted: integer('offers_accepted').notNull().default(0),
    reliabilityScore: smallint('reliability_score').notNull().default(100),
    urgentSuspendedUntil: ts('urgent_suspended_until'),
    stripeAccountId: varchar('stripe_account_id', { length: 64 }),
    payoutsEnabled: boolean('payouts_enabled').notNull().default(false),
    proUntil: ts('pro_until'),
    submittedAt: ts('submitted_at'),
    approvedAt: ts('approved_at'),
    approvedBy: uuid('approved_by'),
    ...timestamps,
  },
  (t) => [
    index('artisan_base_gix').using('gist', t.baseLocation),
    index('artisan_current_gix').using('gist', t.currentLocation),
    index('artisan_status_idx').on(t.status),
  ],
);

export const artisanServices = pgTable(
  'artisan_services',
  {
    id: id(),
    artisanId: uuid('artisan_id')
      .notNull()
      .references(() => artisanProfiles.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id),
    priceCents: integer('price_cents').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('artisan_services_uq').on(t.artisanId, t.serviceId)],
);

export const artisanDocuments = pgTable(
  'artisan_documents',
  {
    id: id(),
    artisanId: uuid('artisan_id')
      .notNull()
      .references(() => artisanProfiles.id, { onDelete: 'cascade' }),
    type: documentTypeEnum('type').notNull(),
    status: documentStatusEnum('status').notNull().default('pending'),
    fileId: uuid('file_id').notNull(),
    label: varchar('label', { length: 100 }),
    expiresAt: date('expires_at'),
    rejectionReason: text('rejection_reason'),
    reviewedBy: uuid('reviewed_by'),
    reviewedAt: ts('reviewed_at'),
    reminderSentAt: ts('reminder_sent_at'),
    ...timestamps,
  },
  (t) => [index('artisan_documents_artisan_idx').on(t.artisanId)],
);

/** Horaires types : weekday 0 = dimanche, heures locales Europe/Paris. */
export const availabilityRules = pgTable(
  'availability_rules',
  {
    id: id(),
    artisanId: uuid('artisan_id')
      .notNull()
      .references(() => artisanProfiles.id, { onDelete: 'cascade' }),
    weekday: smallint('weekday').notNull(),
    startTime: varchar('start_time', { length: 5 }).notNull(),
    endTime: varchar('end_time', { length: 5 }).notNull(),
    ...timestamps,
  },
  (t) => [index('availability_rules_artisan_idx').on(t.artisanId)],
);

/** Indisponibilités ponctuelles (congés, perso). */
export const availabilityExceptions = pgTable(
  'availability_exceptions',
  {
    id: id(),
    artisanId: uuid('artisan_id')
      .notNull()
      .references(() => artisanProfiles.id, { onDelete: 'cascade' }),
    startsAt: ts('starts_at').notNull(),
    endsAt: ts('ends_at').notNull(),
    reason: varchar('reason', { length: 200 }),
    ...timestamps,
  },
  (t) => [index('availability_exceptions_artisan_idx').on(t.artisanId, t.startsAt)],
);

export const addresses = pgTable(
  'addresses',
  {
    id: id(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 40 }).notNull().default('Domicile'),
    line1: varchar('line1', { length: 200 }).notNull(),
    postalCode: varchar('postal_code', { length: 5 }).notNull(),
    city: varchar('city', { length: 100 }).notNull(),
    floor: varchar('floor', { length: 20 }),
    doorCode: varchar('door_code', { length: 20 }),
    accessNotes: text('access_notes'),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    location: geography('location').generatedAlwaysAs(geoFrom('lat', 'lng')),
    isDefault: boolean('is_default').notNull().default(false),
    deletedAt: ts('deleted_at'),
    ...timestamps,
  },
  (t) => [index('addresses_user_idx').on(t.userId), index('addresses_gix').using('gist', t.location)],
);

export const favorites = pgTable(
  'favorites',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    artisanId: uuid('artisan_id')
      .notNull()
      .references(() => artisanProfiles.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [uniqueIndex('favorites_uq').on(t.userId, t.artisanId)],
);

/* ------------------------------------------------------------------ */
/* Domaine 3 : réservations / interventions                            */
/* ------------------------------------------------------------------ */

export const bookings = pgTable(
  'bookings',
  {
    id: id(),
    /** Référence lisible (ex. DEP-7K3Q9X), affichée au client et au support. */
    reference: varchar('reference', { length: 16 }).notNull().unique(),
    kind: bookingKindEnum('kind').notNull(),
    status: bookingStatusEnum('status').notNull().default('pending_payment'),
    clientId: uuid('client_id')
      .notNull()
      .references(() => users.id),
    artisanId: uuid('artisan_id').references(() => artisanProfiles.id),
    domain: domainEnum('domain').notNull(),
    serviceId: uuid('service_id').references(() => services.id),
    scheduledType: scheduledTypeEnum('scheduled_type'),
    addressId: uuid('address_id')
      .notNull()
      .references(() => addresses.id),
    problemReason: varchar('problem_reason', { length: 120 }).notNull(),
    problemDescription: text('problem_description'),
    problemFileIds: uuid('problem_file_ids').array().notNull().default(sql`ARRAY[]::uuid[]`),
    scheduledAt: ts('scheduled_at'),
    endsAt: ts('ends_at'),
    /** Plage occupée dans l'agenda de l'artisan (contrainte d'exclusion anti double réservation). */
    slot: tstzrange('slot').generatedAlwaysAs(
      sql.raw(`(CASE WHEN scheduled_at IS NOT NULL AND ends_at IS NOT NULL THEN tstzrange(scheduled_at, ends_at, '[)') END)`),
    ),
    /** Instantané des prix au moment de la réservation (centimes). */
    basePriceCents: integer('base_price_cents').notNull(),
    travelFeeCents: integer('travel_fee_cents').notNull().default(0),
    urgentFeeCents: integer('urgent_fee_cents').notNull().default(0),
    guaranteeCents: integer('guarantee_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull(),
    authorizedCents: integer('authorized_cents').notNull().default(0),
    capturedCents: integer('captured_cents'),
    commissionRate: real('commission_rate').notNull(),
    commissionCents: integer('commission_cents'),
    currency: varchar('currency', { length: 3 }).notNull().default('EUR'),
    withGuarantee: boolean('with_guarantee').notNull().default(false),
    waivesWithdrawal: boolean('waives_withdrawal').notNull().default(false),
    travelOnly: boolean('travel_only').notNull().default(false),
    /** Code de fin à 4 chiffres : haché pour la vérification, chiffré pour l'affichage client. */
    completionCodeHash: varchar('completion_code_hash', { length: 128 }),
    completionCodeEnc: text('completion_code_enc'),
    completionAttempts: smallint('completion_attempts').notNull().default(0),
    /** Dispatch urgence */
    dispatchWave: smallint('dispatch_wave').notNull().default(0),
    dispatchStartedAt: ts('dispatch_started_at'),
    acceptedAt: ts('accepted_at'),
    etaAt: ts('eta_at'),
    arrivedAt: ts('arrived_at'),
    workDoneAt: ts('work_done_at'),
    closedAt: ts('closed_at'),
    cancelledAt: ts('cancelled_at'),
    cancellationReason: text('cancellation_reason'),
    cancellationFeeCents: integer('cancellation_fee_cents'),
    zoneId: uuid('zone_id').references(() => zones.id),
    ...timestamps,
  },
  (t) => [
    index('bookings_artisan_scheduled_idx').on(t.artisanId, t.scheduledAt),
    index('bookings_client_status_idx').on(t.clientId, t.status),
    index('bookings_status_idx').on(t.status),
  ],
);

/** Journal immuable des transitions : la preuve en cas de litige. */
export const bookingEvents = pgTable(
  'booking_events',
  {
    id: id(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    fromStatus: bookingStatusEnum('from_status'),
    toStatus: bookingStatusEnum('to_status').notNull(),
    actor: actorEnum('actor').notNull(),
    actorUserId: uuid('actor_user_id'),
    note: text('note'),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    ...timestamps,
  },
  (t) => [index('booking_events_booking_idx').on(t.bookingId, t.createdAt)],
);

/** Positions GPS horodatées de l'artisan pendant l'intervention. */
export const bookingLocations = pgTable(
  'booking_locations',
  {
    id: id(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    heading: real('heading'),
    speed: real('speed'),
    ...timestamps,
  },
  (t) => [index('booking_locations_booking_idx').on(t.bookingId, t.createdAt)],
);

export const dispatchOffers = pgTable(
  'dispatch_offers',
  {
    id: id(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    artisanId: uuid('artisan_id')
      .notNull()
      .references(() => artisanProfiles.id),
    wave: smallint('wave').notNull(),
    radiusKm: real('radius_km').notNull(),
    distanceKm: real('distance_km').notNull(),
    rank: smallint('rank').notNull(),
    status: offerStatusEnum('status').notNull().default('pending'),
    expiresAt: ts('expires_at').notNull(),
    respondedAt: ts('responded_at'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('dispatch_offers_uq').on(t.bookingId, t.artisanId),
    index('dispatch_offers_artisan_idx').on(t.artisanId, t.status),
  ],
);

export const quotes = pgTable(
  'quotes',
  {
    id: id(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    artisanId: uuid('artisan_id')
      .notNull()
      .references(() => artisanProfiles.id),
    status: quoteStatusEnum('status').notNull().default('sent'),
    totalCents: integer('total_cents').notNull(),
    needsNewAuthorization: boolean('needs_new_authorization').notNull().default(false),
    keepReplacedParts: boolean('keep_replaced_parts').notNull().default(true),
    expiresAt: ts('expires_at').notNull(),
    answeredAt: ts('answered_at'),
    ...timestamps,
  },
  (t) => [index('quotes_booking_idx').on(t.bookingId)],
);

export const quoteLines = pgTable('quote_lines', {
  id: id(),
  quoteId: uuid('quote_id')
    .notNull()
    .references(() => quotes.id, { onDelete: 'cascade' }),
  kind: quoteLineKindEnum('kind').notNull(),
  label: varchar('label', { length: 200 }).notNull(),
  quantity: real('quantity').notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
  totalCents: integer('total_cents').notNull(),
  position: smallint('position').notNull().default(0),
  ...timestamps,
});

export const interventionReports = pgTable('intervention_reports', {
  id: id(),
  bookingId: uuid('booking_id')
    .notNull()
    .unique()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  feasible: boolean('feasible').notNull(),
  materials: text('materials'),
  notes: text('notes'),
  voiceFileId: uuid('voice_file_id'),
  voiceTranscript: text('voice_transcript'),
  followUpNeeded: boolean('follow_up_needed').notNull().default(false),
  beforeFileIds: uuid('before_file_ids').array().notNull().default(sql`ARRAY[]::uuid[]`),
  afterFileIds: uuid('after_file_ids').array().notNull().default(sql`ARRAY[]::uuid[]`),
  ...timestamps,
});

export const disputes = pgTable(
  'disputes',
  {
    id: id(),
    bookingId: uuid('booking_id')
      .notNull()
      .unique()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    openedBy: uuid('opened_by').notNull(),
    reason: disputeReasonEnum('reason').notNull(),
    description: text('description'),
    previousStatus: bookingStatusEnum('previous_status').notNull(),
    status: disputeStatusEnum('status').notNull().default('open'),
    resolution: disputeResolutionEnum('resolution'),
    resolutionNote: text('resolution_note'),
    capturedCents: integer('captured_cents'),
    refundedCents: integer('refunded_cents'),
    resolvedBy: uuid('resolved_by'),
    resolvedAt: ts('resolved_at'),
    dueAt: ts('due_at').notNull(),
    ...timestamps,
  },
  (t) => [index('disputes_status_idx').on(t.status, t.dueAt)],
);

export const reviews = pgTable(
  'reviews',
  {
    id: id(),
    bookingId: uuid('booking_id')
      .notNull()
      .unique()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    artisanId: uuid('artisan_id')
      .notNull()
      .references(() => artisanProfiles.id),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    rating: smallint('rating').notNull(),
    tags: text('tags').array().notNull().default(sql`ARRAY[]::text[]`),
    comment: text('comment'),
    photoFileIds: uuid('photo_file_ids').array().notNull().default(sql`ARRAY[]::uuid[]`),
    replyBody: text('reply_body'),
    replyAt: ts('reply_at'),
    hiddenAt: ts('hidden_at'),
    ...timestamps,
  },
  (t) => [index('reviews_artisan_idx').on(t.artisanId, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Domaine 4 : paiements et facturation                                */
/* ------------------------------------------------------------------ */

export const payments = pgTable(
  'payments',
  {
    id: id(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id),
    provider: varchar('provider', { length: 20 }).notNull(),
    /** PaymentIntent (pi_…) ou SetupIntent (seti_…) côté Stripe. */
    providerRef: varchar('provider_ref', { length: 128 }),
    kind: varchar('kind', { length: 20 }).notNull().default('authorization'), // authorization | setup | supplement
    status: paymentStatusEnum('status').notNull().default('requires_action'),
    amountCents: integer('amount_cents').notNull(),
    capturedCents: integer('captured_cents'),
    applicationFeeCents: integer('application_fee_cents'),
    paymentMethodRef: varchar('payment_method_ref', { length: 128 }),
    failureReason: text('failure_reason'),
    authorizedAt: ts('authorized_at'),
    capturedAt: ts('captured_at'),
    ...timestamps,
  },
  (t) => [index('payments_booking_idx').on(t.bookingId), uniqueIndex('payments_ref_uq').on(t.providerRef)],
);

/** Webhooks Stripe : idempotence par identifiant d'événement. */
export const webhookEvents = pgTable('webhook_events', {
  id: id(),
  provider: varchar('provider', { length: 20 }).notNull(),
  eventId: varchar('event_id', { length: 128 }).notNull().unique(),
  type: varchar('type', { length: 100 }).notNull(),
  payload: jsonb('payload').notNull(),
  processedAt: ts('processed_at'),
  error: text('error'),
  ...timestamps,
});

export const invoices = pgTable(
  'invoices',
  {
    id: id(),
    number: varchar('number', { length: 32 }).notNull().unique(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id),
    kind: invoiceKindEnum('kind').notNull(),
    /** service : artisan → client ; commission : DEPANO → artisan (Factur-X). */
    issuerName: varchar('issuer_name', { length: 200 }).notNull(),
    issuerSiret: varchar('issuer_siret', { length: 14 }),
    recipientName: varchar('recipient_name', { length: 200 }).notNull(),
    recipientUserId: uuid('recipient_user_id'),
    lines: jsonb('lines').notNull(),
    totalExclTaxCents: integer('total_excl_tax_cents').notNull(),
    vatCents: integer('vat_cents').notNull(),
    totalCents: integer('total_cents').notNull(),
    fileId: uuid('file_id'),
    issuedAt: ts('issued_at').notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [index('invoices_recipient_idx').on(t.recipientUserId)],
);

/* ------------------------------------------------------------------ */
/* Domaine 5 : communication et fichiers                               */
/* ------------------------------------------------------------------ */

export const conversations = pgTable(
  'conversations',
  {
    id: id(),
    bookingId: uuid('booking_id')
      .notNull()
      .unique()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    clientUserId: uuid('client_user_id').notNull(),
    artisanUserId: uuid('artisan_user_id').notNull(),
    clientLastReadAt: ts('client_last_read_at'),
    artisanLastReadAt: ts('artisan_last_read_at'),
    lastMessageAt: ts('last_message_at'),
    ...timestamps,
  },
  (t) => [index('conversations_client_idx').on(t.clientUserId), index('conversations_artisan_idx').on(t.artisanUserId)],
);

export const messages = pgTable(
  'messages',
  {
    id: id(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id'),
    kind: messageKindEnum('kind').notNull().default('text'),
    body: text('body'),
    fileId: uuid('file_id'),
    clientId: varchar('client_id', { length: 64 }),
    flaggedAt: ts('flagged_at'),
    ...timestamps,
  },
  (t) => [
    index('messages_conversation_idx').on(t.conversationId, t.createdAt),
    uniqueIndex('messages_client_id_uq').on(t.conversationId, t.clientId),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body').notNull(),
    link: varchar('link', { length: 255 }),
    data: jsonb('data').notNull().default({}),
    readAt: ts('read_at'),
    ...timestamps,
  },
  (t) => [index('notifications_user_read_idx').on(t.userId, t.readAt)],
);

/** Fichiers dans le bucket privé ; l'API ne transporte jamais le contenu (URL pré-signées). */
export const files = pgTable(
  'files',
  {
    id: id(),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
    purpose: filePurposeEnum('purpose').notNull(),
    storageKey: varchar('storage_key', { length: 255 }).notNull().unique(),
    thumbnailKey: varchar('thumbnail_key', { length: 255 }),
    contentType: varchar('content_type', { length: 100 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    uploadedAt: ts('uploaded_at'),
    deletedAt: ts('deleted_at'),
    ...timestamps,
  },
  (t) => [index('files_owner_idx').on(t.ownerId)],
);

/** Journal d'audit des actions support/admin. */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    actorUserId: uuid('actor_user_id'),
    action: varchar('action', { length: 80 }).notNull(),
    entity: varchar('entity', { length: 40 }).notNull(),
    entityId: uuid('entity_id'),
    data: jsonb('data').notNull().default({}),
    ...timestamps,
  },
  (t) => [index('audit_logs_entity_idx').on(t.entity, t.entityId)],
);
