# @depano/api — API et logique métier DEPANO

API REST `/v1` (NestJS 11 sur Fastify), temps réel Socket.IO, files BullMQ. Toute la logique métier vit ici ;
`@depano/worker` est un process séparé qui démarre un contexte Nest (`WorkerModule`) exporté par ce paquet et
consomme les files avec **les mêmes services**.

Contrat : `packages/schemas` (`client.ts` = liste des routes, `dto.ts` = schémas Zod / DTO, `realtime.ts` = événements
Socket.IO et files, `booking-machine.ts`, `rules.ts`). L'API valide chaque corps / query avec ces schémas Zod
(`ZodValidationPipe`, messages Zod en français) et renvoie toujours les erreurs au format
`ApiErrorBody { statusCode, code, message, details? }`.

## Architecture

```
src/
  main.ts              démarrage HTTP (+ adaptateur Socket.IO Redis, création du bucket S3)
  http.ts              createHttpApp() : Fastify, préfixe /v1, CORS, OpenAPI /docs
  app.module.ts        contrôleurs, gateway, guards globaux (JWT → rôles → artisan), filtre d'erreurs
  core.module.ts       module global : infra + prestataires + services métier (partagé API / worker)
  worker/              WorkerModule, bootstrapWorker(), createProcessors() (aiguillage job → service)
  config/              variables d'environnement validées (Zod), .env racine chargé automatiquement
  common/              erreurs, filtre, pipe Zod, décorateurs d'auth, guards, crypto, pagination, fuseau Paris
  infra/               Postgres (Drizzle), Redis + rate limiting, JobsService (BullMQ), RealtimeService (redis-emitter), S3
  providers/           PaymentProvider (fake | stripe), SmsProvider (console | twilio), PushProvider (console | expo), relais d'appel
  modules/
    auth/              OTP SMS, JWT 15 min + refresh rotatif (familles), Apple/Google (jose JWKS), passkeys (SimpleWebAuthn)
    me/                profil, rôle actif, suppression RGPD, export, badges, push, adresses, favoris, cartes, factures
    catalog/           domaines, recherche PostGIS, profil public, créneaux (Europe/Paris), avis, estimation, géocodage
    bookings/          création, machine à états (BookingStateService), devis, compte rendu, code de fin, capture, litiges
    dispatch/          vagues d'urgence (find_dispatch_candidates), offres, acceptation concurrente
    payments/          empreintes / captures / libérations, webhooks Stripe idempotents
    artisan/           SIRET (API Recherche d'entreprises), KYC, services, disponibilités, planning, revenus, stats
    chat/ notifications/ files/ admin/ invoices/ maintenance/ health/ realtime/
```

Points clés :

- **Machine à états unique** : `BookingStateService.transition(id, to, actor, actorUserId, opts)` verrouille la ligne
  (`SELECT … FOR UPDATE`), vérifie `findTransition`, horodate, écrit `booking_events`, puis après commit émet
  `booking.updated`, crée les notifications (+ job push) et un message système dans la conversation.
- **Dispatch** : job `start` → vague 1 (5 km, 3 artisans, 60 s) ; `wave-timeout` → vague suivante (10, 20 km) ou
  `expired` (empreinte libérée + premier créneau planifié proposé). L'acceptation verrouille l'intervention : la
  première gagne, les autres offres passent en `taken` et reçoivent `offer.revoked`. Refus de toute la vague ⇒ vague
  suivante immédiate.
- **Paiement** : PaymentIntent `capture_method=manual` (urgence et RDV ≤ 6 jours), sinon SetupIntent + job
  `authorize-scheduled` 24 h avant. Devis > autorisé + 20 % : autorisation complémentaire à valider par le client
  (`PaymentSessionDto` renvoyé) ; devis dans la fourchette : complément autorisé hors session sur la carte enregistrée.
  Capture à la validation du code (ou auto 24 h après le compte rendu, sauf litige), commission = `computeCommission`
  (jamais sur des frais de déplacement seuls). Stripe : `transfer_data.destination` quand l'artisan est connu à la
  création (RDV), sinon transfert séparé après capture (urgence).
- **Code de fin** : 4 chiffres générés à l'acceptation, stockés hachés (HMAC) + chiffrés (AES-256-GCM, visibles du seul
  client). 3 erreurs ⇒ blocage (423), audit log et alerte support.
- **Adresse masquée** : l'artisan ne voit l'adresse exacte qu'à partir de `accepted` (`artisanCanSeeExactAddress`),
  sinon coordonnées approchées à 2 décimales.
- **Temps réel** : les services publient via `@socket.io/redis-emitter` (utilisable depuis le worker) ; chaque instance
  API relaie via `@socket.io/redis-adapter`. JWT dans `handshake.auth.token`, room `user:{id}` automatique,
  `booking.subscribe` (contrôle d'accès, rejoint aussi la room de conversation), `location.update`, `typing`.
- **Rôles** : `@Public()`, `@OptionalAuth()` (visiteurs : catalogue, estimation, géocodage), `@Roles(...)`,
  `@ArtisanOnly({ approved })`. Contrôle de propriété dans chaque service. Back-office : le support lit interventions,
  litiges (et les arbitre), utilisateurs et artisans ; l'admin seul gère validation des artisans / documents,
  catalogue, zones, indicateurs et export DAC7. Toute mutation admin écrit `audit_logs`.

## Lancer en local

```bash
pnpm infra:up                 # Postgres+PostGIS, Redis, S3 (SeaweedFS)
pnpm db:migrate && pnpm db:seed
pnpm --filter @depano/api dev      # http://localhost:3000/v1 — docs : http://localhost:3000/docs
pnpm --filter @depano/worker dev   # workers BullMQ (dispatch, notifications, factures…)
```

Connexion en dev : `POST /v1/auth/otp/request {"phone":"+33600000010"}` renvoie `devCode` (hors production) et le
SMS est affiché dans la console de l'API. Comptes de démo : client `+33600000010`, artisans `+33600000101…106`,
artisan en attente `+33600000199`, admin `+33600000001`, support `+33600000002`.

Production : `pnpm --filter @depano/api build && pnpm --filter @depano/api start` (idem worker), ou les images
`infra/docker/Dockerfile.api` / `Dockerfile.worker` (construites depuis la racine du dépôt).

## Tests

```bash
pnpm --filter @depano/api test
```

Vitest (+ SWC pour les métadonnées de décorateurs). Les tests d'intégration utilisent la base `depano_test` du
conteneur Postgres (créée et migrée par `test/global-setup.ts`), Redis db 15 et le bucket S3 local ; les files sont
remplacées par une implémentation mémoire et les jobs (dispatch, factures…) sont exécutés de façon synchrone via les
mêmes processeurs que le worker. Variables : `TEST_DATABASE_URL`, `TEST_REDIS_URL`.

## Variables d'environnement

Lues depuis le `.env` racine (voir `.env.example`) ; valeurs par défaut adaptées au dev.

| Variable | Rôle |
| --- | --- |
| `NODE_ENV` | `production` masque `devCode` et exige des secrets non par défaut |
| `API_PORT`, `API_PUBLIC_URL` | port HTTP, URL publique (liens d'onboarding Stripe) |
| `DATABASE_URL`, `REDIS_URL` | Postgres + PostGIS, Redis (BullMQ, rate limiting, Socket.IO) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `OTP_PEPPER` | signatures JWT, hachage refresh / OTP / code de fin |
| `DATA_ENCRYPTION_KEY` | (optionnel) clé AES du code de fin, sinon dérivée de `JWT_REFRESH_SECRET` |
| `APPLE_CLIENT_ID`, `GOOGLE_CLIENT_ID` | audiences acceptées (séparées par des virgules) |
| `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGINS` | (optionnels) passkeys : domaine RP et origines autorisées |
| `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | stockage objet ; `S3_PUBLIC_ENDPOINT` (optionnel) sert aux URL signées vues par le téléphone |
| `PAYMENT_PROVIDER` | `fake` (tout réussit, aucun appel externe) ou `stripe` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` | Stripe Connect Express ; webhook : `POST /v1/webhooks/stripe` |
| `SMS_PROVIDER` | `console` ou `twilio` (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`) |
| `TWILIO_PROXY_SERVICE_SID` | si défini, relais d'appel Twilio Proxy ; sinon numéro factice |
| `PUSH_PROVIDER` | `console` ou `expo` (`EXPO_ACCESS_TOKEN` optionnel) |
| `OFFLINE_MODE` | `true` : pas d'appel aux API publiques (adresse, SIRET) — utilisé en test |
| `RATE_LIMIT_MULTIPLIER` | hors production : coefficient des plafonds de débit (défaut ×20 en `development`, ×1 en `test`) ; le délai entre deux OTP est divisé d'autant. Ignoré en production |
| `RATE_LIMIT_DISABLED` | hors production : `true` désactive toute limitation de débit (OTP, réservations, appels, envois). Ignoré en production |

## Files BullMQ (worker)

| File | Jobs |
| --- | --- |
| `dispatch` | `start`, `wave-timeout` (60 s) |
| `notifications` | `push`, `sms` (5 essais, backoff exponentiel) |
| `bookings` | `auto-capture` (24 h), `reminder` (veille, 1 h avant), `authorize-scheduled`, `quote-expire` (30 min) |
| `files` | `thumbnail` (sharp, 400 px WebP) |
| `invoices` | `generate` (PDF pdfkit : facture de prestation artisan → client + facture de commission DEPANO → artisan, numérotation `F-YYYY-000001`) |
| `maintenance` | `document-expiry` (quotidien, relance 30 j avant), `data-retention` (purge chats/photos > 3 ans), `reliability` (3 annulations / 30 j ⇒ urgences suspendues 30 j) |

## Limites connues / TODO

- TVA : factures calculées en TTC avec 20 % par défaut ; le régime de chaque artisan (franchise, 10 % rénovation…)
  reste à paramétrer. Mentions légales DEPANO (SIRET, TVA, médiateur) à compléter dans `invoices.service.ts`.
- Facture électronique Factur-X / plateforme agréée non branchée (PDF simple).
- Pagination par décalage pour la recherche et le back-office (curseur temporel pour les listes chronologiques).
- Le relais d'appel factice renvoie un numéro fictif ; Twilio Proxy n'a pas été testé contre le vrai service.
- `StripePaymentProvider` est implémenté mais non testé contre Stripe (tests en `PAYMENT_PROVIDER=fake`).
