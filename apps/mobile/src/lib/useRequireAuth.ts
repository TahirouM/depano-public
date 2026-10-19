import { router, useGlobalSearchParams, usePathname } from 'expo-router';
import { useCallback } from 'react';
import { selectIsSignedIn, useAuthStore } from '@/stores/auth';

/**
 * Pattern « auth gate » : un visiteur navigue librement ; quand une action exige un compte
 * (payer, discuter…), on ouvre la connexion puis on revient exactement ici.
 *
 * ```ts
 * const requireAuth = useRequireAuth();
 * const onPay = () => { if (!requireAuth('Créez votre compte pour payer — 30 secondes.')) return; pay(); };
 * ```
 * Renvoie true si l'utilisateur est déjà connecté.
 */
export function useRequireAuth() {
  const signedIn = useAuthStore(selectIsSignedIn);
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  return useCallback(
    (reason?: string) => {
      if (signedIn) return true;
      const search = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (typeof v === 'string' && !pathname.includes(v)) search.set(k, v);
      }
      const qs = search.toString();
      useAuthStore.getState().setReturnTo(qs ? `${pathname}?${qs}` : pathname, reason ?? null);
      router.push('/connexion');
      return false;
    },
    [signedIn, pathname, params],
  );
}
