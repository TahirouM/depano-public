#!/usr/bin/env node
/**
 * Enregistre les réponses GET de l'API locale (données de seed) pour la démo statique
 * (EXPO_PUBLIC_DEMO=1) : `node scripts/record-demo.mjs [http://localhost:3000]`.
 * Écrit src/lib/demo/fixtures.json, rejoué par le faux backend de src/lib/demo/.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/+$/, '');
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '../src/lib/demo/fixtures.json');
/** Photos (avatars, bannières…) copiées dans le build : les URL S3 signées expirent en quelques minutes. */
const MEDIA_DIR = join(HERE, '../public/demo-media');
const CLIENT_PHONE = '+33600000010';
const ARTISAN_PHONE = '+33600000101';
const MARSEILLE = { lat: 43.2965, lng: 5.3698 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, path, { token, body, query } = {}) {
  const url = new URL(`/v1${path}`, BASE);
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method,
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

async function login(phone) {
  for (let i = 0; i < 5; i++) {
    const r = await call('POST', '/auth/otp/request', { body: { phone } });
    if (r.json?.devCode) {
      const v = await call('POST', '/auth/otp/verify', { body: { phone, code: r.json.devCode } });
      if (v.status < 300) return v.json.accessToken;
      throw new Error(`verify ${phone}: ${JSON.stringify(v.json)}`);
    }
    await sleep(((r.json?.details?.retryAfterSeconds ?? r.json?.retryAfterSeconds ?? 3) + 1) * 1000);
  }
  throw new Error(`OTP impossible pour ${phone} (l'API tourne-t-elle hors production ?)`);
}

const keyOf = (path, query) => {
  const q = Object.entries(query ?? {})
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return q ? `${path}?${q}` : path;
};

function recorder(token) {
  const out = {};
  const get = async (path, query) => {
    const r = await call('GET', path, { token, query });
    if (r.status >= 300) {
      console.warn(`  ! ${r.status} ${keyOf(path, query)}`);
      return null;
    }
    out[keyOf(path, query)] = r.json;
    return r.json;
  };
  return { out, get };
}

const dayOffset = (n) => new Date(Date.now() + n * 86_400_000).toISOString();

async function recordCommon(get) {
  await get('/me');
  await get('/me/badges');
  await get('/me/notification-preferences');
  await get('/auth/sessions');
  await get('/domains');
  await get('/notifications');
  const convs = (await get('/conversations')) ?? [];
  for (const c of convs) await get(`/conversations/${c.id}/messages`);
}

async function recordBookings(get, as) {
  const ids = new Set();
  for (const scope of ['all', 'active', 'past']) {
    const page = await get('/bookings', { as, scope, limit: 100 });
    for (const b of page?.items ?? []) ids.add(b.id);
  }
  for (const id of ids) await get(`/bookings/${id}`);
  return ids;
}

/** Télécharge chaque photo signée et remplace son URL par un chemin statique /demo-media/…. */
async function localizeMedia(data) {
  let json = JSON.stringify(data);
  const urls = [...new Set(json.match(/https?:\/\/[^"]*X-Amz-Signature[^"]*/g) ?? [])];
  mkdirSync(MEDIA_DIR, { recursive: true });
  const local = new Map();
  for (const url of urls) {
    const path = new URL(url).pathname.split('/').slice(-3);
    const name = `${path[0]}-${path[2]}`;
    if (!local.has(name)) {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`  ! photo ${res.status} ${name}`);
        continue;
      }
      writeFileSync(join(MEDIA_DIR, name), Buffer.from(await res.arrayBuffer()));
      local.set(name, `/demo-media/${name}`);
    }
    json = json.split(url).join(local.get(name));
  }
  console.log(`${local.size} photo(s) copiée(s) dans public/demo-media`);
  return JSON.parse(json);
}

async function main() {
  console.log(`API : ${BASE}`);
  const clientToken = await login(CLIENT_PHONE);
  const client = recorder(clientToken);
  console.log('Client…');
  await recordCommon(client.get);
  for (const p of ['/me/addresses', '/me/favorites', '/me/payment-methods', '/me/invoices', '/me/referral']) await client.get(p);
  const search = await client.get('/artisans', { ...MARSEILLE, radiusKm: 50, limit: 50 });
  for (const a of search?.items ?? []) {
    const pub = await client.get(`/artisans/${a.id}`);
    await client.get(`/artisans/${a.id}/reviews`);
    await client.get(`/artisans/${a.id}/slots`, { days: 14 });
    for (const s of pub?.services ?? []) await client.get(`/artisans/${a.id}/slots`, { days: 14, serviceId: s.serviceId });
  }
  await recordBookings(client.get, 'client');

  const artisanToken = await login(ARTISAN_PHONE);
  const artisan = recorder(artisanToken);
  console.log('Artisan…');
  await recordCommon(artisan.get);
  for (const p of ['/artisan/profile', '/artisan/availability/exceptions', '/artisan/dashboard', '/artisan/earnings', '/artisan/stats', '/artisan/reviews', '/artisan/promotion']) {
    await artisan.get(p);
  }
  // Fenêtre limitée à 3 mois par requête : deux fenêtres, fusionnées par le faux backend.
  await artisan.get('/artisan/planning', { from: dayOffset(-90), to: dayOffset(0) });
  await artisan.get('/artisan/planning', { from: dayOffset(0), to: dayOffset(90) });
  const offers = (await artisan.get('/artisan/offers')) ?? [];
  for (const o of offers) await artisan.get(`/artisan/offers/${o.id}`);
  await recordBookings(artisan.get, 'artisan');

  const data = await localizeMedia({ recordedAt: new Date().toISOString(), client: client.out, artisan: artisan.out });
  writeFileSync(OUT, `${JSON.stringify(data)}\n`);
  console.log(`${Object.keys(client.out).length} réponses client, ${Object.keys(artisan.out).length} artisan → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
