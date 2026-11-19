#!/usr/bin/env bash
# Démo publique depuis le Mac : tunnels Cloudflare (sans compte) vers l'API, le stockage S3,
# l'app web et le back-office. Ctrl+C arrête tout ce que le script a lancé.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGS="$ROOT/.demo"
mkdir -p "$LOGS"
PIDS=()

cleanup() {
  echo
  echo "Arrêt de la démo…"
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
  exit 0
}
trap cleanup INT TERM

command -v cloudflared >/dev/null || { echo "Installez cloudflared : brew install cloudflared"; exit 1; }

free_port() { lsof -ti ":$1" | xargs kill 2>/dev/null || true; }

tunnel() {
  local port=$1 log="$LOGS/tunnel-$1.log"
  : > "$log"
  cloudflared tunnel --no-autoupdate --url "http://localhost:$port" > "$log" 2>&1 &
  PIDS+=($!)
  for _ in $(seq 1 60); do
    local url
    url=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$log" | head -1 || true)
    if [ -n "$url" ]; then echo "$url"; return; fi
    sleep 1
  done
  echo "Tunnel vers le port $port impossible (voir $log)" >&2
  exit 1
}

wait_http() {
  for _ in $(seq 1 120); do curl -sf -o /dev/null "$1" && return; sleep 2; done
  echo "$1 ne répond pas" >&2
  exit 1
}

cd "$ROOT"
echo "1/6 Infrastructure (Postgres, Redis, S3)…"
pnpm infra:up >/dev/null 2>&1
pnpm build >/dev/null
pnpm db:migrate >/dev/null

echo "2/6 Ouverture des tunnels…"
API_URL=$(tunnel 3000)
S3_URL=$(tunnel 9000)
ADMIN_URL=$(tunnel 3001)
APP_URL=$(tunnel 8090)

echo "3/6 API et worker…"
free_port 3000
S3_PUBLIC_ENDPOINT="$S3_URL" API_PUBLIC_URL="$API_URL" pnpm --filter @depano/api start > "$LOGS/api.log" 2>&1 &
PIDS+=($!)
if ! pgrep -f "apps/worker" >/dev/null; then
  pnpm --filter @depano/worker start > "$LOGS/worker.log" 2>&1 &
  PIDS+=($!)
fi
wait_http "http://localhost:3000/v1/health"

echo "4/6 Back-office (build de production)…"
free_port 3001
pnpm --filter @depano/admin build > "$LOGS/admin-build.log" 2>&1
pnpm --filter @depano/admin exec next start -p 3001 > "$LOGS/admin.log" 2>&1 &
PIDS+=($!)

echo "5/6 App web (export statique pointant vers l'API publique)…"
(cd apps/mobile && EXPO_PUBLIC_API_URL="$API_URL" npx expo export --platform web --output-dir dist-demo --clear > "$LOGS/expo-export.log" 2>&1)
free_port 8090
npx --yes serve@14.2.4 -s apps/mobile/dist-demo -l 8090 > "$LOGS/app.log" 2>&1 &
PIDS+=($!)

echo "6/6 Vérification des liens publics…"
wait_http "$API_URL/v1/health"
wait_http "http://localhost:8090"
wait_http "http://localhost:3001/login"

cat <<EOF

  ✅ Démo en ligne (tant que ce terminal reste ouvert)

  App (client et artisan) : $APP_URL
  Back-office             : $ADMIN_URL
  API / doc               : $API_URL/docs

  Comptes de démo (le code SMS s'affiche à l'écran) :
    Client  +33600000010   ·   Artisan +33600000101
    Admin   +33600000001   ·   Support +33600000002

  Ctrl+C pour tout arrêter. Logs : $LOGS
EOF

wait
