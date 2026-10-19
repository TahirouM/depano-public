-- Pas de double réservation : un artisan ne peut avoir deux interventions actives qui se chevauchent.
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (artisan_id WITH =, slot WITH &&)
  WHERE (slot IS NOT NULL AND artisan_id IS NOT NULL AND status IN (
    'pending_payment','accepted','en_route','arrived','quote_pending','in_progress','awaiting_code'));
--> statement-breakpoint
ALTER TABLE reviews ADD CONSTRAINT reviews_rating_range CHECK (rating BETWEEN 1 AND 5);
--> statement-breakpoint
ALTER TABLE bookings ADD CONSTRAINT bookings_amounts_positive CHECK (total_cents >= 0 AND authorized_cents >= 0);
--> statement-breakpoint
ALTER TABLE availability_rules ADD CONSTRAINT availability_rules_weekday CHECK (weekday BETWEEN 0 AND 6 AND start_time < end_time);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS zones_center_gix ON zones USING gist (center);
--> statement-breakpoint
-- Dispatch : artisans validés, disponibles, du bon métier, à moins de X km, non déjà sollicités.
-- Classement : distance, note, taux d'acceptation, fiabilité.
CREATE OR REPLACE FUNCTION find_dispatch_candidates(
  p_booking_id uuid, p_domain domain_code, p_lat double precision, p_lng double precision,
  p_radius_km double precision, p_limit integer
) RETURNS TABLE (artisan_id uuid, user_id uuid, distance_km double precision, score double precision)
LANGUAGE sql STABLE AS $$
  WITH origin AS (SELECT ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography AS g)
  SELECT a.id, a.user_id,
         ST_Distance(COALESCE(a.current_location, a.base_location), o.g) / 1000.0 AS distance_km,
         (ST_Distance(COALESCE(a.current_location, a.base_location), o.g) / 1000.0)
           - COALESCE(a.rating_avg, 4.0) * 1.5
           - (CASE WHEN a.offers_received > 0 THEN a.offers_accepted::float / a.offers_received ELSE 0.7 END) * 3
           - a.reliability_score / 50.0 AS score
  FROM artisan_profiles a, origin o
  WHERE a.status = 'approved'
    AND a.urgent_available
    AND (a.urgent_suspended_until IS NULL OR a.urgent_suspended_until < now())
    AND p_domain = ANY(a.domains)
    AND COALESCE(a.current_location, a.base_location) IS NOT NULL
    AND ST_DWithin(COALESCE(a.current_location, a.base_location), o.g, p_radius_km * 1000)
    AND NOT EXISTS (SELECT 1 FROM dispatch_offers d WHERE d.booking_id = p_booking_id AND d.artisan_id = a.id)
    AND NOT EXISTS (
      SELECT 1 FROM bookings b WHERE b.artisan_id = a.id
        AND b.status IN ('accepted','en_route','arrived','quote_pending','in_progress')
        AND (b.kind = 'urgent' OR b.scheduled_at < now() + interval '2 hours'))
  ORDER BY score ASC
  LIMIT p_limit
$$;
--> statement-breakpoint
-- Row Level Security : seconde barrière derrière la couche service de l'API.
-- L'API se connecte avec le propriétaire des tables (qui contourne RLS) et applique
-- ses propres contrôles ; ces politiques protègent tout accès par le rôle restreint
-- depano_app (lectures support, outils d'analyse, futurs services) qui doit poser
-- SET LOCAL app.user_id = '<uuid>' dans sa transaction.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'depano_app') THEN
    CREATE ROLE depano_app NOLOGIN;
  END IF;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON bookings, addresses, messages, conversations, notifications, payments TO depano_app;
--> statement-breakpoint
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY bookings_participants ON bookings TO depano_app USING (
  client_id = app_user_id()
  OR artisan_id IN (SELECT id FROM artisan_profiles WHERE user_id = app_user_id()));
--> statement-breakpoint
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY addresses_owner ON addresses TO depano_app USING (
  user_id = app_user_id()
  OR id IN (SELECT b.address_id FROM bookings b JOIN artisan_profiles a ON a.id = b.artisan_id
            WHERE a.user_id = app_user_id() AND b.status NOT IN ('pending_payment','searching','expired')));
--> statement-breakpoint
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY conversations_participants ON conversations TO depano_app USING (
  client_user_id = app_user_id() OR artisan_user_id = app_user_id());
--> statement-breakpoint
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY messages_participants ON messages TO depano_app USING (
  conversation_id IN (SELECT id FROM conversations WHERE client_user_id = app_user_id() OR artisan_user_id = app_user_id()));
--> statement-breakpoint
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY notifications_owner ON notifications TO depano_app USING (user_id = app_user_id());
--> statement-breakpoint
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY payments_participants ON payments TO depano_app USING (
  booking_id IN (SELECT id FROM bookings WHERE client_id = app_user_id()));
