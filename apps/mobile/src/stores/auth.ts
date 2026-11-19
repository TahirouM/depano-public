import type { AuthTokens } from '@depano/schemas';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { secureJSONStorage } from './storage';

/**
 * Session : jetons dans expo-secure-store. Le profil (`Me`) vit dans le cache TanStack Query
 * (clé qk.me), persisté pour la lecture hors ligne.
 */
/** Démo statique (EXPO_PUBLIC_DEMO=1) : session factice, chargée seulement dans ce build. */
const demoSession: Pick<AuthState, 'accessToken' | 'refreshToken' | 'userId'> | null =
  process.env.EXPO_PUBLIC_DEMO === '1' ? (require('@/lib/demo/backend') as typeof import('@/lib/demo/backend')).DEMO_SESSION : null;

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  /** Écran où revenir après connexion (pattern requireAuth). Non persisté. */
  returnTo: string | null;
  /** Message affiché sur l'écran de connexion (« Créez votre compte pour payer »). */
  authReason: string | null;
  setSession: (tokens: Pick<AuthTokens, 'accessToken' | 'refreshToken'>, userId: string) => void;
  setTokens: (tokens: Pick<AuthTokens, 'accessToken' | 'refreshToken'>) => void;
  clear: () => void;
  setReturnTo: (path: string | null, reason?: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Démo statique : déjà connecté, tout est visitable sans saisir de numéro.
      accessToken: demoSession?.accessToken ?? null,
      refreshToken: demoSession?.refreshToken ?? null,
      userId: demoSession?.userId ?? null,
      returnTo: null,
      authReason: null,
      setSession: (t, userId) => set({ accessToken: t.accessToken, refreshToken: t.refreshToken, userId }),
      setTokens: (t) => set({ accessToken: t.accessToken, refreshToken: t.refreshToken }),
      clear: () => set({ accessToken: null, refreshToken: null, userId: null }),
      setReturnTo: (returnTo, reason = null) => set({ returnTo, authReason: reason }),
    }),
    {
      name: 'depano.session',
      storage: secureJSONStorage,
      partialize: (s) => ({ accessToken: s.accessToken, refreshToken: s.refreshToken, userId: s.userId }),
    },
  ),
);

export const selectIsSignedIn = (s: AuthState) => !!s.refreshToken;
