import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { api } from './api';
import { resolveDeepLink } from './deepLinks';
import { env, features } from './env';

/**
 * Notifications push (expo-notifications).
 * - La permission n'est JAMAIS demandée au lancement : voir askPermission('notifications').
 * - Le jeton Expo est enregistré via me.registerPushToken dès que la permission est accordée.
 * - Un tap sur une notification ouvre son lien profond (`data.link`) dans le bon espace.
 */
if (Platform.OS !== 'web') Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function configureAndroidChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Interventions et messages',
    importance: Notifications.AndroidImportance.HIGH,
  });
  // Urgences désactivées (features.urgent) : pas de canal visible dans les réglages Android. Android
  // restaure les réglages de l'utilisateur si le canal est recréé avec le même identifiant.
  if (!features.urgent) {
    await Notifications.deleteNotificationChannelAsync('urgent');
    return;
  }
  await Notifications.setNotificationChannelAsync('urgent', {
    name: "Demandes d'urgence",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400],
  });
}

/** Enregistre le jeton si la permission est déjà accordée (aucune popup). */
export async function registerPushTokenIfGranted(): Promise<void> {
  try {
    const userId = useAuthStore.getState().userId;
    if (!userId || Platform.OS === 'web' || !Device.isDevice) return;
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;
    await configureAndroidChannels();
    const { data: token } = await Notifications.getExpoPushTokenAsync(env.easProjectId ? { projectId: env.easProjectId } : undefined);
    const saved = useAppStore.getState().pushToken;
    if (saved?.token === token && saved.userId === userId) return;
    await api.me.registerPushToken({ token, platform: Platform.OS === 'ios' ? 'ios' : 'android' });
    useAppStore.getState().setPushToken({ token, userId });
  } catch (e) {
    // Expo Go Android (SDK 53+) ou projet EAS non configuré : pas de push, l'app fonctionne.
    if (__DEV__) console.info('[push] jeton indisponible :', (e as Error).message);
  }
}

/** Déconnexion : retire le jeton de cet appareil côté API (avant de révoquer la session). Sans effet s'il n'y en a pas. */
export async function unregisterPushToken(): Promise<void> {
  const saved = useAppStore.getState().pushToken;
  const userId = useAuthStore.getState().userId;
  if (!saved || saved.userId !== userId) return;
  try {
    await api.me.unregisterPushToken(saved.token);
  } catch (e) {
    if (__DEV__) console.info('[push] désinscription impossible :', (e as Error).message);
  }
}

function linkFromResponse(r: Notifications.NotificationResponse | null | undefined): string | null {
  const data = r?.notification.request.content.data as Record<string, unknown> | undefined;
  const link = data?.link ?? data?.url;
  return typeof link === 'string' ? link : null;
}

/** Route les taps sur notification (app ouverte, en fond ou lancée par la notification). */
function useNotificationRoutingNative(ready: boolean) {
  const last = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !last) return;
    const id = last.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const href = resolveDeepLink(linkFromResponse(last), useAppStore.getState().activeRole);
    if (href) router.push(href as Href);
  }, [ready, last]);
}

/** Pas de notifications push sur le web : no-op (le module natif n'existe pas). */
export const useNotificationRouting: (ready: boolean) => void = Platform.OS === 'web' ? () => undefined : useNotificationRoutingNative;
