import type { AuthResult } from '@depano/schemas';
import { router, type Href } from 'expo-router';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useDraftsStore } from '@/stores/drafts';
import { useOutboxStore } from '@/stores/outbox';
import { api, setSessionExpiredHandler } from './api';
import { queryClient, queryPersister } from './query/client';
import { qk } from './query/keys';
import { registerPushTokenIfGranted, unregisterPushToken } from './push';

/** Enregistre la session après OTP / Apple / Google. */
export function completeSignIn(result: AuthResult) {
  useAuthStore.getState().setSession(result, result.user.id);
  queryClient.setQueryData(qk.me, result.user);
  if (!result.isNewUser) useAppStore.getState().setActiveRole(result.user.activeRole);
  void registerPushTokenIfGranted();
}

/** Vide tout ce qui est personnel (cache, brouillons, file d'envoi). */
async function wipeLocalData() {
  useAuthStore.getState().clear();
  useAppStore.getState().resetForSignOut();
  useDraftsStore.getState().resetAll();
  useOutboxStore.getState().clear();
  queryClient.clear();
  await queryPersister.removeClient();
}

export async function signOut() {
  const refreshToken = useAuthStore.getState().refreshToken;
  // Plus de push pour ce compte sur cet appareil (jeton d'accès encore valide à ce stade).
  await unregisterPushToken();
  if (refreshToken) await api.auth.logout({ refreshToken }).catch(() => undefined);
  await wipeLocalData();
  router.replace('/accueil');
}

/** Suppression du compte (exigence Apple/Google : accessible en 2 taps). */
export async function deleteAccount() {
  await api.me.delete();
  await wipeLocalData();
  router.replace('/accueil');
}

/** Fin du parcours de connexion : retour là où l'utilisateur était (pattern requireAuth). */
export function finishAuthFlow(fallback?: Href) {
  const { returnTo, setReturnTo } = useAuthStore.getState();
  setReturnTo(null);
  const role = useAppStore.getState().activeRole;
  const target = (returnTo as Href | null) ?? fallback ?? (role === 'artisan' ? '/pro/accueil' : '/accueil');
  router.dismissTo(target);
}

setSessionExpiredHandler(() => {
  queryClient.removeQueries({ queryKey: qk.me });
});
