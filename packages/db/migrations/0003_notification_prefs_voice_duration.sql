ALTER TABLE "messages" ADD COLUMN "duration_ms" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notification_prefs" jsonb DEFAULT '{}'::jsonb NOT NULL;