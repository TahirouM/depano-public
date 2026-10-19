# Infrastructure (Terraform, Scaleway fr-par)

Données hébergées en France. Un module `modules/stack` instancié par environnement (`envs/staging`, `envs/prod`) :

- VPC + réseau privé : Postgres et Redis ne sont accessibles que depuis les conteneurs.
- PostgreSQL managé (PostGIS), chiffré au repos, sauvegardes quotidiennes (7 j staging, 30 j prod, HA en prod).
- Redis managé TLS (BullMQ, rate limiting, adaptateur Socket.IO).
- Bucket objet privé versionné (photos, KYC, factures) — accès uniquement par URL signées.
- Serverless Containers : `api` (public, health check `/v1/health`) et `worker` (privé).

Les secrets (`JWT_*`, `OTP_PEPPER`, `STRIPE_*`, `TWILIO_*`, `S3_*`, `EXPO_ACCESS_TOKEN`) sont passés via `TF_VAR_secrets`
depuis le coffre de secrets GitHub Actions, jamais commités.

```bash
cd envs/staging
terraform init
TF_VAR_image_tag=$(git rev-parse HEAD) terraform apply
```

Le bucket d'état `depano-terraform-state` est à créer une fois à la main. Les migrations Drizzle sont appliquées
au démarrage du conteneur API (`pnpm db:migrate` dans l'entrypoint).

> Note : si les WebSockets longue durée posent problème en Serverless Containers, basculer l'API sur une instance
> Kapsule (Kubernetes) ou des Instances derrière un Load Balancer — le code ne change pas.
