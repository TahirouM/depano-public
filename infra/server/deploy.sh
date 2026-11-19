#!/usr/bin/env bash
# Déploie l'arbre de travail courant sur le VPS de test (ssh ovh) :  infra/server/deploy.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HOST="${DEPLOY_HOST:-ovh}"
rsync -az --delete \
  --exclude node_modules --exclude .git --exclude .turbo --exclude dist --exclude .next --exclude .expo \
  --exclude 'dist-*' --exclude .demo --exclude .vercel --exclude .env --exclude '.env.*' --exclude .DS_Store \
  --exclude infra/terraform --exclude infra/server/s3.json --exclude .admin-basic-auth --include .env.example \
  "$ROOT/" "$HOST:/opt/depano/"
ssh "$HOST" "ADMIN_PHONE='${ADMIN_PHONE:-}' bash /opt/depano/infra/server/remote.sh"
