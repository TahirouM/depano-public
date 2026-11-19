#!/usr/bin/env bash
# Exécuté sur le VPS par deploy.sh : configuration initiale (une fois), build, migrations, redémarrage.
set -euo pipefail
cd /opt/depano
HOST_SUFFIX="${HOST_SUFFIX:-167-114-71-66.sslip.io}"
rnd() { openssl rand -hex "${1:-24}"; }

# 1) Secrets et .env (créés une seule fois, jamais écrasés)
if [ ! -f .env ]; then
  PG_PW=$(rnd 16); S3_SECRET=$(rnd 20)
  cat > .env <<ENV
NODE_ENV=production
API_PORT=3000
API_PUBLIC_URL=https://api.${HOST_SUFFIX}
DATABASE_URL=postgres://depano:${PG_PW}@127.0.0.1:5432/depano
POSTGRES_PASSWORD=${PG_PW}
REDIS_URL=redis://127.0.0.1:6379
JWT_ACCESS_SECRET=$(rnd)
JWT_REFRESH_SECRET=$(rnd)
OTP_PEPPER=$(rnd)
DATA_ENCRYPTION_KEY=$(rnd 32)
SMS_PROVIDER=console
S3_ENDPOINT=http://127.0.0.1:9000
S3_PUBLIC_ENDPOINT=https://s3.${HOST_SUFFIX}
S3_REGION=fr-par
S3_BUCKET=depano-private
S3_ACCESS_KEY=depano
S3_SECRET_KEY=${S3_SECRET}
PAYMENT_PROVIDER=fake
PUSH_PROVIDER=expo
WEBAUTHN_RP_ID=api.${HOST_SUFFIX}
WEBAUTHN_ORIGINS=https://api.${HOST_SUFFIX}
# Phase de test (à désactiver avant l'ouverture) :
OTP_EXPOSE_CODE=true
ARTISAN_SIRET_OPTIONAL=true
LOG_LEVEL=info
ENV
  chmod 600 .env
fi
if [ ! -f .env.mobile ]; then
  echo "EXPO_PUBLIC_API_URL=https://api.${HOST_SUFFIX}" > .env.mobile
fi
set -a; . ./.env; set +a

# 2) Infrastructure (Postgres, Redis, S3)
if [ ! -f infra/server/s3.json ]; then
  cat > infra/server/s3.json <<JSON
{ "identities": [ { "name": "depano", "credentials": [{ "accessKey": "${S3_ACCESS_KEY}", "secretKey": "${S3_SECRET_KEY}" }], "actions": ["Admin", "Read", "Write", "List", "Tagging"] } ] }
JSON
  chmod 600 infra/server/s3.json
fi
sudo docker compose --env-file .env -f infra/server/docker-compose.yml up -d --wait

# 3) Dépendances, build, migrations, initialisation (sans données de démo)
export CI=true
pnpm install --frozen-lockfile
NODE_ENV=production pnpm turbo run build --filter=!@depano/mobile
pnpm db:migrate
ADMIN_PHONE="${ADMIN_PHONE:-+33600000001}" pnpm --filter @depano/db bootstrap

# Version web de l'app (sans installation ni compte) servie par Caddy sur app.<HOST_SUFFIX>
( cd apps/mobile && set -a && . ../../.env.mobile && set +a && NODE_ENV=production pnpm exec expo export --platform web --output-dir ../../web.new --clear >/dev/null )
rm -rf web.old; [ -d web ] && mv web web.old; mv web.new web; rm -rf web.old

# 4) Caddy (HTTPS) avec authentification basique sur le back-office
if [ ! -f .admin-basic-auth ]; then
  echo "depano:$(rnd 9)" > .admin-basic-auth; chmod 600 .admin-basic-auth
fi
ADMIN_BASIC_USER=${ADMIN_BASIC_USER:-$(cut -d: -f1 .admin-basic-auth)}
ADMIN_BASIC_HASH=$(caddy hash-password --plaintext "$(cut -d: -f2 .admin-basic-auth)")
export HOST_SUFFIX ADMIN_BASIC_USER ADMIN_BASIC_HASH
envsubst '${HOST_SUFFIX} ${ADMIN_BASIC_USER} ${ADMIN_BASIC_HASH}' < infra/server/Caddyfile.tmpl | sudo tee /etc/caddy/Caddyfile >/dev/null
sudo systemctl reload caddy || sudo systemctl restart caddy

# 5) Services applicatifs
sudo cp infra/server/depano-*.service /etc/systemd/system/
sudo systemctl daemon-reload
for s in api worker admin metro; do sudo systemctl enable --now "depano-$s" >/dev/null 2>&1; sudo systemctl restart "depano-$s"; done
sleep 5
systemctl --no-pager --plain is-active depano-api depano-worker depano-admin depano-metro caddy
