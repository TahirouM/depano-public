ALTER TYPE "public"."booking_status" ADD VALUE 'requested' BEFORE 'searching';--> statement-breakpoint
ALTER TYPE "public"."file_purpose" ADD VALUE 'banner';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'booking_requested';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'price_proposed';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'referral_reward';--> statement-breakpoint
CREATE TABLE "referral_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"other_user_id" uuid,
	"role" varchar(10) NOT NULL,
	"amount_cents" integer NOT NULL,
	"used_booking_id" uuid,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artisan_profiles" ADD COLUMN "banner_file_id" uuid;--> statement-breakpoint
ALTER TABLE "artisan_profiles" ADD COLUMN "promotion_auto_renew" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "artisan_profiles" ADD COLUMN "promotion_subscription_ref" varchar(128);--> statement-breakpoint
ALTER TABLE "availability_exceptions" ADD COLUMN "kind" varchar(20) DEFAULT 'unavailable' NOT NULL;--> statement-breakpoint
ALTER TABLE "availability_exceptions" ADD COLUMN "color" varchar(16);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "price_on_request" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "artisan_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "rescheduled_from_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "artisan_note" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "discount_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "intervention_reports" ADD COLUMN "not_feasible_reason" varchar(40);--> statement-breakpoint
ALTER TABLE "intervention_reports" ADD COLUMN "rescheduled_booking_id" uuid;--> statement-breakpoint
ALTER TABLE "referral_credits" ADD CONSTRAINT "referral_credits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_credits" ADD CONSTRAINT "referral_credits_other_user_id_users_id_fk" FOREIGN KEY ("other_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_credits" ADD CONSTRAINT "referral_credits_used_booking_id_bookings_id_fk" FOREIGN KEY ("used_booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "referral_credits_user_idx" ON "referral_credits" USING btree ("user_id","used_at");--> statement-breakpoint
-- Une demande de RDV en attente de l'artisan bloque déjà le créneau. Liste en négatif : la nouvelle valeur
-- d'enum « requested » n'est pas utilisable comme littéral dans la transaction qui l'ajoute.
ALTER TABLE bookings DROP CONSTRAINT bookings_no_overlap;
--> statement-breakpoint
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (artisan_id WITH =, slot WITH &&)
  WHERE (slot IS NOT NULL AND artisan_id IS NOT NULL AND status NOT IN (
    'searching','closed','cancelled_by_client','cancelled_by_artisan','expired','disputed'));
--> statement-breakpoint
CREATE UNIQUE INDEX referral_credits_referee_uq ON referral_credits (user_id) WHERE role = 'referee';
--> statement-breakpoint
-- L'adresse exacte reste masquée à l'artisan tant qu'il n'a pas accepté la demande.
DROP POLICY addresses_owner ON addresses;
--> statement-breakpoint
CREATE POLICY addresses_owner ON addresses TO depano_app USING (
  user_id = app_user_id()
  OR id IN (SELECT b.address_id FROM bookings b JOIN artisan_profiles a ON a.id = b.artisan_id
            WHERE a.user_id = app_user_id() AND b.status IN ('accepted','en_route','arrived','quote_pending','in_progress','awaiting_code','closed',
                                                                 'cancelled_by_client','cancelled_by_artisan','disputed')));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON referral_credits TO depano_app;
