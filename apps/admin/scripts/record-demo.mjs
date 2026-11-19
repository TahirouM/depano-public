#!/usr/bin/env node
/**
 * Enregistre les réponses GET de l'API locale (données de seed) pour la démo en ligne du back-office
 * (NEXT_PUBLIC_DEMO=1) : `node scripts/record-demo.mjs [http://localhost:3000]`.
 * Écrit src/lib/demo/fixtures.json, rejoué dans le navigateur par src/lib/demo/backend.ts.
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/+$/, '');
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '../src/lib/demo/fixtures.json');
/** Photos et pièces copiées dans le build : les URL S3 signées expirent en quelques minutes. */
const MEDIA_DIR = join(HERE, '../public/demo-media');
/** Copies déjà faites par la démo mobile, reprises si l'URL signée n'est pas joignable d'ici. */
const MOBILE_MEDIA_DIR = join(HERE, '../../mobile/public/demo-media');
const ADMIN_PHONE = '+33600000001';
/** Périodes du tableau de bord, en jours (« mois en cours » rejoue la plus proche). */
const METRIC_SPANS = [7, 30, 90, 365];

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

async function localizeMedia(data) {
  let json = JSON.stringify(data);
  const urls = [...new Set(json.match(/https?:\/\/[^"]*X-Amz-Signature[^"]*/g) ?? [])];
  mkdirSync(MEDIA_DIR, { recursive: true });
  const local = new Map();
  for (const url of urls) {
    const path = new URL(url).pathname.split('/').slice(-3);
    const name = `${path[0]}-${path[2]}`;
    if (!local.has(name)) {
      // L'URL publique peut viser l'IP du poste sur un autre réseau : on reprend alors la copie de la démo mobile.
      const res = await fetch(url).catch(() => null);
      if (res?.ok) writeFileSync(join(MEDIA_DIR, name), Buffer.from(await res.arrayBuffer()));
      else if (existsSync(join(MOBILE_MEDIA_DIR, name))) copyFileSync(join(MOBILE_MEDIA_DIR, name), join(MEDIA_DIR, name));
      else console.warn(`  ! fichier ${res?.status ?? 'injoignable'} ${name} (retiré)`);
      local.set(name, existsSync(join(MEDIA_DIR, name)) ? `/demo-media/${name}` : null);
    }
    // Fichier introuvable : le champ passe à null (l'interface affiche ses initiales / son fond par défaut).
    json = local.get(name) ? json.split(url).join(local.get(name)) : json.split(`"${url}"`).join('null');
  }
  console.log(`${[...local.values()].filter(Boolean).length} fichier(s) copié(s) dans public/demo-media`);
  return JSON.parse(json);
}

async function main() {
  console.log(`API : ${BASE}`);
  const token = await login(ADMIN_PHONE);
  const out = {};
  const get = async (path, query) => {
    const r = await call('GET', path, { token, query });
    if (r.status >= 300) {
      console.warn(`  ! ${r.status} ${path}`);
      return null;
    }
    return r.json;
  };
  /** Liste paginée complète (le faux backend filtre et pagine lui-même). */
  const all = async (path) => {
    const items = [];
    let cursor;
    do {
      const page = await get(path, { limit: 100, cursor });
      items.push(...(page?.items ?? []));
      cursor = page?.nextCursor ?? undefined;
    } while (cursor);
    return items;
  };

  out['/me'] = await get('/me');
  out['/domains'] = await get('/domains');
  out['/admin/services'] = await get('/admin/services');
  out['/admin/zones'] = await get('/admin/zones');
  out['/admin/disputes'] = await get('/admin/disputes');
  for (const days of METRIC_SPANS) {
    const to = new Date();
    const from = new Date(to.getTime() - days * 86_400_000);
    from.setHours(0, 0, 0, 0);
    out[`/admin/metrics#${days}`] = await get('/admin/metrics', { from: from.toISOString(), to: to.toISOString() });
  }
  out['/admin/artisans'] = await all('/admin/artisans');
  for (const a of out['/admin/artisans']) out[`/admin/artisans/${a.id}`] = await get(`/admin/artisans/${a.id}`);
  out['/admin/bookings'] = await all('/admin/bookings');
  for (const b of out['/admin/bookings']) out[`/admin/bookings/${b.id}`] = await get(`/admin/bookings/${b.id}`);
  out['/admin/users'] = await all('/admin/users');

  const data = await localizeMedia({ recordedAt: new Date().toISOString(), store: out });
  writeFileSync(OUT, `${JSON.stringify(data)}\n`);
  console.log(`${Object.keys(out).length} réponses → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
