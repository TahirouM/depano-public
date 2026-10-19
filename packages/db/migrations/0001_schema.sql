CREATE TYPE "public"."actor" AS ENUM('client', 'artisan', 'system', 'support');--> statement-breakpoint
CREATE TYPE "public"."artisan_status" AS ENUM('draft', 'pending_review', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."booking_kind" AS ENUM('urgent', 'scheduled');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending_payment', 'searching', 'accepted', 'en_route', 'arrived', 'quote_pending', 'in_progress', 'awaiting_code', 'closed', 'cancelled_by_client', 'cancelled_by_artisan', 'expired', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."dispute_reason" AS ENUM('never_came', 'travel_only', 'poor_quality', 'overcharged', 'other');--> statement-breakpoint
CREATE TYPE "public"."dispute_resolution" AS ENUM('full_capture', 'partial_capture', 'travel_fee_only', 'full_refund');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('pending', 'approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('identity', 'insurance_decennale', 'insurance_rc_pro', 'qualification');--> statement-breakpoint
CREATE TYPE "public"."domain_code" AS ENUM('plomberie', 'electricite', 'energetique');--> statement-breakpoint
CREATE TYPE "public"."file_purpose" AS ENUM('avatar', 'problem_photo', 'problem_voice', 'report_before', 'report_after', 'chat', 'document', 'portfolio', 'review');--> statement-breakpoint
CREATE TYPE "public"."invoice_kind" AS ENUM('service', 'commission');--> statement-breakpoint
CREATE TYPE "public"."message_kind" AS ENUM('text', 'image', 'voice', 'system');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('booking_created', 'booking_accepted', 'booking_status', 'booking_cancelled', 'booking_expired', 'urgent_offer', 'quote_received', 'quote_answered', 'message', 'review_received', 'reminder', 'artisan_approved', 'artisan_rejected', 'document_expiring', 'payout');--> statement-breakpoint
CREATE TYPE "public"."dispatch_offer_status" AS ENUM('pending', 'accepted', 'declined', 'expired', 'taken');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('requires_action', 'authorized', 'captured', 'partially_captured', 'cancelled', 'refunded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."quote_line_kind" AS ENUM('labor', 'part', 'travel');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('sent', 'accepted', 'refused', 'expired');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('client', 'artisan', 'support', 'admin');--> statement-breakpoint
CREATE TYPE "public"."scheduled_type" AS ENUM('maintenance', 'repair');--> statement-breakpoint
CREATE TYPE "public"."service_kind" AS ENUM('maintenance', 'repair', 'both');--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"label" varchar(40) DEFAULT 'Domicile' NOT NULL,
	"line1" varchar(200) NOT NULL,
	"postal_code" varchar(5) NOT NULL,
	"city" varchar(100) NOT NULL,
	"floor" varchar(20),
	"door_code" varchar(20),
	"access_notes" text,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"location" geography(Point, 4326) GENERATED ALWAYS AS ((CASE WHEN lat IS NOT NULL AND lng IS NOT NULL THEN ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography END)) STORED,
	"is_default" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artisan_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artisan_id" uuid NOT NULL,
	"type" "document_type" NOT NULL,
	"status" "document_status" DEFAULT 'pending' NOT NULL,
	"file_id" uuid NOT NULL,
	"label" varchar(100),
	"expires_at" date,
	"rejection_reason" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artisan_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "artisan_status" DEFAULT 'draft' NOT NULL,
	"rejection_reason" text,
	"siret" varchar(14),
	"company_name" varchar(200),
	"company_address" text,
	"ape_code" varchar(10),
	"company_active" boolean,
	"display_name" varchar(80) NOT NULL,
	"bio" text,
	"domains" "domain_code"[] DEFAULT ARRAY[]::domain_code[] NOT NULL,
	"qualifications" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"base_lat" double precision,
	"base_lng" double precision,
	"base_location" geography(Point, 4326) GENERATED ALWAYS AS ((CASE WHEN base_lat IS NOT NULL AND base_lng IS NOT NULL THEN ST_SetSRID(ST_MakePoint(base_lng, base_lat), 4326)::geography END)) STORED,
	"base_city" varchar(100),
	"radius_km" smallint DEFAULT 15 NOT NULL,
	"travel_fee_cents" integer DEFAULT 2500 NOT NULL,
	"portfolio_file_ids" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"urgent_available" boolean DEFAULT false NOT NULL,
	"current_lat" double precision,
	"current_lng" double precision,
	"current_location" geography(Point, 4326) GENERATED ALWAYS AS ((CASE WHEN current_lat IS NOT NULL AND current_lng IS NOT NULL THEN ST_SetSRID(ST_MakePoint(current_lng, current_lat), 4326)::geography END)) STORED,
	"current_location_at" timestamp with time zone,
	"rating_avg" real,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"offers_received" integer DEFAULT 0 NOT NULL,
	"offers_accepted" integer DEFAULT 0 NOT NULL,
	"reliability_score" smallint DEFAULT 100 NOT NULL,
	"urgent_suspended_until" timestamp with time zone,
	"stripe_account_id" varchar(64),
	"payouts_enabled" boolean DEFAULT false NOT NULL,
	"pro_until" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artisan_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "artisan_profiles_siret_unique" UNIQUE("siret")
);
--> statement-breakpoint
CREATE TABLE "artisan_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artisan_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"price_cents" integer NOT NULL,
	"duration_minutes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(80) NOT NULL,
	"entity" varchar(40) NOT NULL,
	"entity_id" uuid,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artisan_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artisan_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"from_status" "booking_status",
	"to_status" "booking_status" NOT NULL,
	"actor" "actor" NOT NULL,
	"actor_user_id" uuid,
	"note" text,
	"lat" double precision,
	"lng" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"heading" real,
	"speed" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(16) NOT NULL,
	"kind" "booking_kind" NOT NULL,
	"status" "booking_status" DEFAULT 'pending_payment' NOT NULL,
	"client_id" uuid NOT NULL,
	"artisan_id" uuid,
	"domain" "domain_code" NOT NULL,
	"service_id" uuid,
	"scheduled_type" "scheduled_type",
	"address_id" uuid NOT NULL,
	"problem_reason" varchar(120) NOT NULL,
	"problem_description" text,
	"problem_file_ids" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"scheduled_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"slot" tstzrange GENERATED ALWAYS AS ((CASE WHEN scheduled_at IS NOT NULL AND ends_at IS NOT NULL THEN tstzrange(scheduled_at, ends_at, '[)') END)) STORED,
	"base_price_cents" integer NOT NULL,
	"travel_fee_cents" integer DEFAULT 0 NOT NULL,
	"urgent_fee_cents" integer DEFAULT 0 NOT NULL,
	"guarantee_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"authorized_cents" integer DEFAULT 0 NOT NULL,
	"captured_cents" integer,
	"commission_rate" real NOT NULL,
	"commission_cents" integer,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"with_guarantee" boolean DEFAULT false NOT NULL,
	"waives_withdrawal" boolean DEFAULT false NOT NULL,
	"travel_only" boolean DEFAULT false NOT NULL,
	"completion_code_hash" varchar(128),
	"completion_code_enc" text,
	"completion_attempts" smallint DEFAULT 0 NOT NULL,
	"dispatch_wave" smallint DEFAULT 0 NOT NULL,
	"dispatch_started_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"eta_at" timestamp with time zone,
	"arrived_at" timestamp with time zone,
	"work_done_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"cancellation_fee_cents" integer,
	"zone_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "client_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"default_address_id" uuid,
	"referral_code" varchar(16),
	"referred_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "client_profiles_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" varchar(40) NOT NULL,
	"version" varchar(20) NOT NULL,
	"granted" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"client_user_id" uuid NOT NULL,
	"artisan_user_id" uuid NOT NULL,
	"client_last_read_at" timestamp with time zone,
	"artisan_last_read_at" timestamp with time zone,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "dispatch_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"artisan_id" uuid NOT NULL,
	"wave" smallint NOT NULL,
	"radius_km" real NOT NULL,
	"distance_km" real NOT NULL,
	"rank" smallint NOT NULL,
	"status" "dispatch_offer_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"opened_by" uuid NOT NULL,
	"reason" "dispute_reason" NOT NULL,
	"description" text,
	"previous_status" "booking_status" NOT NULL,
	"status" "dispute_status" DEFAULT 'open' NOT NULL,
	"resolution" "dispute_resolution",
	"resolution_note" text,
	"captured_cents" integer,
	"refunded_cents" integer,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"due_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "disputes_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"code" "domain_code" PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"icon" varchar(40) NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"artisan_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"purpose" "file_purpose" NOT NULL,
	"storage_key" varchar(255) NOT NULL,
	"thumbnail_key" varchar(255),
	"content_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "files_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "intervention_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"feasible" boolean NOT NULL,
	"materials" text,
	"notes" text,
	"voice_file_id" uuid,
	"voice_transcript" text,
	"follow_up_needed" boolean DEFAULT false NOT NULL,
	"before_file_ids" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"after_file_ids" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "intervention_reports_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" varchar(32) NOT NULL,
	"booking_id" uuid NOT NULL,
	"kind" "invoice_kind" NOT NULL,
	"issuer_name" varchar(200) NOT NULL,
	"issuer_siret" varchar(14),
	"recipient_name" varchar(200) NOT NULL,
	"recipient_user_id" uuid,
	"lines" jsonb NOT NULL,
	"total_excl_tax_cents" integer NOT NULL,
	"vat_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"file_id" uuid,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid,
	"kind" "message_kind" DEFAULT 'text' NOT NULL,
	"body" text,
	"file_id" uuid,
	"client_id" varchar(64),
	"flagged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"link" varchar(255),
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(20) NOT NULL,
	"code_hash" varchar(128) NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"ip" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"transports" text[],
	"device_name" varchar(100),
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "passkeys_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"provider" varchar(20) NOT NULL,
	"provider_ref" varchar(128),
	"kind" varchar(20) DEFAULT 'authorization' NOT NULL,
	"status" "payment_status" DEFAULT 'requires_action' NOT NULL,
	"amount_cents" integer NOT NULL,
	"captured_cents" integer,
	"application_fee_cents" integer,
	"payment_method_ref" varchar(128),
	"failure_reason" text,
	"authorized_at" timestamp with time zone,
	"captured_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"platform" varchar(10) NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "quote_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"kind" "quote_line_kind" NOT NULL,
	"label" varchar(200) NOT NULL,
	"quantity" real NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"artisan_id" uuid NOT NULL,
	"status" "quote_status" DEFAULT 'sent' NOT NULL,
	"total_cents" integer NOT NULL,
	"needs_new_authorization" boolean DEFAULT false NOT NULL,
	"keep_replaced_parts" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"artisan_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"comment" text,
	"photo_file_ids" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"reply_body" text,
	"reply_at" timestamp with time zone,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" "domain_code" NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"kind" "service_kind" DEFAULT 'both' NOT NULL,
	"urgent_eligible" boolean DEFAULT true NOT NULL,
	"reference_price_cents" integer NOT NULL,
	"default_duration_minutes" integer DEFAULT 60 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" varchar(128) NOT NULL,
	"family_id" uuid NOT NULL,
	"device_name" varchar(100),
	"user_agent" text,
	"ip" varchar(64),
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(20),
	"phone_verified_at" timestamp with time zone,
	"email" varchar(255),
	"first_name" varchar(80),
	"last_name" varchar(80),
	"avatar_file_id" uuid,
	"roles" "role"[] DEFAULT ARRAY['client']::role[] NOT NULL,
	"active_role" "role" DEFAULT 'client' NOT NULL,
	"apple_sub" varchar(255),
	"google_sub" varchar(255),
	"stripe_customer_id" varchar(64),
	"suspended_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(20) NOT NULL,
	"event_id" varchar(128) NOT NULL,
	"type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"center_lat" double precision NOT NULL,
	"center_lng" double precision NOT NULL,
	"center" geography(Point, 4326) GENERATED ALWAYS AS ((CASE WHEN center_lat IS NOT NULL AND center_lng IS NOT NULL THEN ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography END)) STORED,
	"radius_km" real NOT NULL,
	"commission_rate" real DEFAULT 0.15 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artisan_documents" ADD CONSTRAINT "artisan_documents_artisan_id_artisan_profiles_id_fk" FOREIGN KEY ("artisan_id") REFERENCES "public"."artisan_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artisan_profiles" ADD CONSTRAINT "artisan_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artisan_services" ADD CONSTRAINT "artisan_services_artisan_id_artisan_profiles_id_fk" FOREIGN KEY ("artisan_id") REFERENCES "public"."artisan_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artisan_services" ADD CONSTRAINT "artisan_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_artisan_id_artisan_profiles_id_fk" FOREIGN KEY ("artisan_id") REFERENCES "public"."artisan_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_artisan_id_artisan_profiles_id_fk" FOREIGN KEY ("artisan_id") REFERENCES "public"."artisan_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_locations" ADD CONSTRAINT "booking_locations_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_artisan_id_artisan_profiles_id_fk" FOREIGN KEY ("artisan_id") REFERENCES "public"."artisan_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_offers" ADD CONSTRAINT "dispatch_offers_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_offers" ADD CONSTRAINT "dispatch_offers_artisan_id_artisan_profiles_id_fk" FOREIGN KEY ("artisan_id") REFERENCES "public"."artisan_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_artisan_id_artisan_profiles_id_fk" FOREIGN KEY ("artisan_id") REFERENCES "public"."artisan_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intervention_reports" ADD CONSTRAINT "intervention_reports_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_artisan_id_artisan_profiles_id_fk" FOREIGN KEY ("artisan_id") REFERENCES "public"."artisan_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_artisan_id_artisan_profiles_id_fk" FOREIGN KEY ("artisan_id") REFERENCES "public"."artisan_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_domain_domains_code_fk" FOREIGN KEY ("domain") REFERENCES "public"."domains"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_user_idx" ON "addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "addresses_gix" ON "addresses" USING gist ("location");--> statement-breakpoint
CREATE INDEX "artisan_documents_artisan_idx" ON "artisan_documents" USING btree ("artisan_id");--> statement-breakpoint
CREATE INDEX "artisan_base_gix" ON "artisan_profiles" USING gist ("base_location");--> statement-breakpoint
CREATE INDEX "artisan_current_gix" ON "artisan_profiles" USING gist ("current_location");--> statement-breakpoint
CREATE INDEX "artisan_status_idx" ON "artisan_profiles" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "artisan_services_uq" ON "artisan_services" USING btree ("artisan_id","service_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "availability_exceptions_artisan_idx" ON "availability_exceptions" USING btree ("artisan_id","starts_at");--> statement-breakpoint
CREATE INDEX "availability_rules_artisan_idx" ON "availability_rules" USING btree ("artisan_id");--> statement-breakpoint
CREATE INDEX "booking_events_booking_idx" ON "booking_events" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "booking_locations_booking_idx" ON "booking_locations" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "bookings_artisan_scheduled_idx" ON "bookings" USING btree ("artisan_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "bookings_client_status_idx" ON "bookings" USING btree ("client_id","status");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "conversations_client_idx" ON "conversations" USING btree ("client_user_id");--> statement-breakpoint
CREATE INDEX "conversations_artisan_idx" ON "conversations" USING btree ("artisan_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dispatch_offers_uq" ON "dispatch_offers" USING btree ("booking_id","artisan_id");--> statement-breakpoint
CREATE INDEX "dispatch_offers_artisan_idx" ON "dispatch_offers" USING btree ("artisan_id","status");--> statement-breakpoint
CREATE INDEX "disputes_status_idx" ON "disputes" USING btree ("status","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_uq" ON "favorites" USING btree ("user_id","artisan_id");--> statement-breakpoint
CREATE INDEX "files_owner_idx" ON "files" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "invoices_recipient_idx" ON "invoices" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_client_id_uq" ON "messages" USING btree ("conversation_id","client_id");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "otp_phone_idx" ON "otp_codes" USING btree ("phone","created_at");--> statement-breakpoint
CREATE INDEX "payments_booking_idx" ON "payments" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_ref_uq" ON "payments" USING btree ("provider_ref");--> statement-breakpoint
CREATE INDEX "push_tokens_user_idx" ON "push_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "quotes_booking_idx" ON "quotes" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "reviews_artisan_idx" ON "reviews" USING btree ("artisan_id","created_at");--> statement-breakpoint
CREATE INDEX "services_domain_idx" ON "services" USING btree ("domain");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_uq" ON "sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_uq" ON "users" USING btree ("phone") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_apple_uq" ON "users" USING btree ("apple_sub");--> statement-breakpoint
CREATE UNIQUE INDEX "users_google_uq" ON "users" USING btree ("google_sub");