# Serveur de test (VPS OVH 167.114.71.66)

Déploiement de l'arbre de travail local : `infra/server/deploy.sh` (rsync puis `remote.sh` sur `ssh ovh`).
Le premier passage génère `/opt/depano/.env` (secrets aléatoires), jamais écrasé ensuite.

| Service | URL |
| --- | --- |
| API | https://api.167-114-71-66.sslip.io/v1 (doc : `/docs`) |
| Back-office | https://admin.167-114-71-66.sslip.io (auth basique : `/opt/depano/.admin-basic-auth`) |
| Stockage S3 | https://s3.167-114-71-66.sslip.io |
| App (Expo Go) | `exp://167.114.71.66:8081` |

Infra (Postgres, Redis, SeaweedFS) : `docker compose` dans `infra/server`, ports liés à 127.0.0.1.
Applications : services systemd `depano-api`, `depano-worker`, `depano-admin`, `depano-metro` ; HTTPS par Caddy.

Mode test actif (`.env`) : `OTP_EXPOSE_CODE=true` (code OTP pré-rempli dans l'app, aucun SMS),
`ARTISAN_SIRET_OPTIONAL=true`, `PAYMENT_PROVIDER=fake`. Compte admin : `ADMIN_PHONE` (défaut +33600000001).

Logs : `ssh ovh 'journalctl -u depano-api -f'`.

## Expo Go

Projet EAS `@depano/depano` (organisation Expo `depano`, `owner` + `projectId` dans `apps/mobile/app.json`).
Metro est connecté avec le jeton d'un robot de l'organisation (`EXPO_TOKEN` dans `/opt/depano/.env.mobile`) : il signe
les manifestes, condition imposée par Expo Go pour un projet servi depuis internet. Chaque testeur doit être membre de
l'organisation `depano` et connecté à son compte dans Expo Go.

## Expo Go pour plusieurs testeurs (EAS Update, recommandé)

L'app est publiée sur EAS Update (canal `preview`, runtime `exposdk:58.0.0`), branchée sur l'API du VPS.
Tout membre de l'organisation Expo `depano`, connecté à **son propre** compte dans Expo Go, peut l'ouvrir :
`exp://u.expo.dev/4b97e49f-278d-42b2-81ad-410a0fa0072f?channel-name=preview&runtime-version=exposdk:58.0.0`

Republier après une modification de l'app : `pnpm --filter @depano/mobile update:preview` (compte Expo connecté ou `EXPO_TOKEN`).
