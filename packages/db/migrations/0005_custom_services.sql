ALTER TABLE "artisan_services" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "owner_artisan_id" uuid;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_owner_artisan_id_artisan_profiles_id_fk" FOREIGN KEY ("owner_artisan_id") REFERENCES "public"."artisan_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "services_owner_idx" ON "services" USING btree ("owner_artisan_id");