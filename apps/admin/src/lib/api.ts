'use client';

import { ApiError, createApiClient } from '@depano/schemas';

/**
 * Client API du back-office. Il réutilise le client typé partagé, mais toutes
 * les requêtes passent par le proxy Next (/api/proxy) qui ajoute le jeton
 * stocké en cookie httpOnly : aucun jeton n'est lisible en JavaScript.
 */
const PLACEHOLDER_BASE = 'http://depano.invalid';

/** Démo en ligne (NEXT_PUBLIC_DEMO=1) : réponses enregistrées, rejouées dans le navigateur. */
const demoFetch: typeof fetch | undefined =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  process.env.NEXT_PUBLIC_DEMO === '1' ? require('./demo/backend').demoFetch : undefined;

let redirecting = false;

async function onSessionExpired() {
  if (redirecting || typeof window === 'undefined') return false;
  redirecting = true;
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
  const next = window.location.pathname + window.location.search;
  // Rechargement complet voulu : purge le cache des requêtes de la session précédente.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?next=${encodeURIComponent(next)}&expired=1`);
  return false;
}

export const api = createApiClient({
  baseUrl: PLACEHOLDER_BASE,
  getAccessToken: () => null,
  onUnauthorized: onSessionExpired,
  fetch: (input, init) => {
    if (demoFetch) return demoFetch(input, init);
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const path = url.pathname.replace(/^\/v1\//, '/api/proxy/');
    return fetch(`${path}${url.search}`, { ...init, credentials: 'same-origin', cache: 'no-store' });
  },
});

export { ApiError };

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 403) return "Vous n'avez pas les droits nécessaires pour cette action.";
    if (e.status === 404) return 'Élément introuvable.';
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return 'Une erreur est survenue.';
}
