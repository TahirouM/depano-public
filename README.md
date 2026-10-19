# DEPANO

Marketplace mobile qui met un particulier en relation avec un artisan vérifié (plomberie, électricité, énergétique)
en moins de 60 secondes, pour une urgence ou un rendez-vous planifié. Lancement : Marseille.

Le plan produit et technique de référence est dans [`DEPANO — Plan produit & technique de l'app mobile (1).md`](./DEPANO%20—%20Plan%20produit%20%26%20technique%20de%20l'app%20mobile%20(1).md).

## Monorepo

| Chemin | Rôle |
| --- | --- |
| `apps/mobile` | App Expo / React Native, un compte, deux espaces (client et artisan `pro/`) — [README](apps/mobile/README.md) |
| `apps/api` | API NestJS (Fastify) REST `/v1` + WebSocket Socket.IO, toute la logique métier — [README](apps/api/README.md) |
| `apps/worker` | Workers BullMQ : dispatch urgence, push/SMS, captures, rappels, factures PDF, maintenance |
| `apps/admin` | Back-office Next.js (admin et support) — [README](apps/admin/README.md) |
| `packages/schemas` | Contrat partagé : enums, machine à états, règles métier, schémas Zod, client API typé, événements temps réel |
| `packages/db` | Schéma Drizzle (PostgreSQL + PostGIS), migrations, seed de démo |
| `packages/ui` | Design system React Native (tokens clair/sombre, composants accessibles) |
| `infra/docker` | docker compose local, Dockerfiles API et worker |
| `infra/terraform` | Scaleway fr-par : Postgres, Redis, bucket privé, conteneurs — [README](infra/terraform/README.md) |
| `.github/workflows` | CI (tests sur Postgres jetable, images, déploiement staging) et EAS (mobile) |

## Démarrer en local

Prérequis : Node 22+, pnpm 11, Docker.

```bash
cp .env.example .env
pnpm install
pnpm infra:up                      # Postgres+PostGIS :5432, Redis :6379, S3 (SeaweedFS) :9000
pnpm build                         # packages partagés
pnpm db:migrate && pnpm db:seed    # schéma + données de démo Marseille

pnpm --filter @depano/api dev      # http://localhost:3000/v1 — doc OpenAPI : /docs
pnpm --filter @depano/worker dev
pnpm --filter @depano/admin dev    # http://localhost:3001
pnpm --filter @depano/mobile start # Expo (i = iOS, a = Android, w = web)
```

En développement, aucun service externe n'est requis : `PAYMENT_PROVIDER=fake`, `SMS_PROVIDER=console`,
`PUSH_PROVIDER=console`. Le code OTP est renvoyé dans la réponse de `/auth/otp/request` (hors production) et
pré-rempli par l'app.

### Comptes de démo (seed)

| Téléphone | Rôle |
| --- | --- |
| +33600000010 | Client (adresse Marseille 1er) |
| +33600000101 à 106 | Artisans validés (101 plombier dispo urgences, 102 électricienne, 103 énergétique…) |
| +33600000199 | Artisan en attente de validation |
| +33600000001 | Admin (back-office) |
| +33600000002 | Support (back-office) |

## Tests

```bash
pnpm typecheck
pnpm test        # schémas, API (intégration sur Postgres réel `depano_test`), design system, mobile
```

## Ce qui reste à faire avant la bêta

- Brancher les vrais prestataires : Stripe Connect (comptes, webhooks), Twilio (SMS OTP, relais d'appel), Expo push / APNs / FCM.
- Coordonnées légales DEPANO et régime de TVA par artisan dans les factures ; Factur-X via une plateforme agréée.
- Development build natif (EAS) et tests sur appareils réels iOS/Android (l'app a été validée sur le build web).
- CGU, CGV, modèle de devis et statut d'intermédiaire de paiement à valider avec un avocat.
- Comptes Apple / Google développeur, Stripe, Scaleway ; recrutement des 50 premiers artisans.
