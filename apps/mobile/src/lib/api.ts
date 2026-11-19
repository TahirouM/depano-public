import { ApiError, createApiClient, type AuthTokens } from '@depano/schemas';
import { useAuthStore } from '@/stores/auth';
import { env } from './env';

// Démo statique : faux backend chargé seulement si EXPO_PUBLIC_DEMO=1 (variable remplacée au build).
const demoFetch: typeof fetch | undefined =
  process.env.EXPO_PUBLIC_DEMO === '1' ? (require('./demo/backend') as typeof import('./demo/backend')).demoFetch : undefined;

/** Client sans gestion du 401 : sert uniquement au rafraîchissement des jetons. */
const bare = createApiClient({ baseUrl: env.apiUrl, getAccessToken: () => null, fetch: demoFetch });

let inflight: Promise<boolean> | null = null;
/** Appelé quand la session est définitivement perdue (refresh refusé). */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(fn: () => void) {
  onSessionExpired = fn;
}

/**
 * Rafraîchit les jetons une seule fois même si 10 requêtes reçoivent un 401 en même temps
 * (single-flight). Renvoie true si la requête d'origine peut être rejouée.
 */
export function refreshTokens(): Promise<boolean> {
  if (inflight) return inflight;
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return Promise.resolve(false);
  inflight = (async () => {
    try {
      const tokens: AuthTokens = await bare.auth.refresh({ refreshToken });
      useAuthStore.getState().setTokens(tokens);
      return true;
    } catch (e) {
      // Erreur réseau : on garde la session (hors ligne), la requête échouera proprement.
      if (e instanceof ApiError && !e.isNetwork && (e.status === 400 || e.status === 401 || e.status === 403)) {
        useAuthStore.getState().clear();
        onSessionExpired?.();
      }
      return false;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Instance partagée du client typé @depano/schemas. */
export const api = createApiClient({
  baseUrl: env.apiUrl,
  getAccessToken: () => useAuthStore.getState().accessToken,
  onUnauthorized: refreshTokens,
  fetch: demoFetch,
});

export type Api = typeof api;

/** Message humain pour n'importe quelle erreur (les messages ApiError sont rédigés côté API). */
export function errorMessage(e: unknown, fallback = 'Une erreur est survenue. Réessayez.'): string {
  if (e instanceof ApiError) {
    if (e.isNetwork) return 'Connexion impossible. Vérifiez votre réseau.';
    if (e.status >= 500) return 'Le service est momentanément indisponible. Réessayez dans un instant.';
    return e.message || fallback;
  }
  return fallback;
}

export function isNetworkError(e: unknown): boolean {
  return e instanceof ApiError && e.isNetwork;
}

export { ApiError };
