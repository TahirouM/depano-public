import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Linking, Platform } from 'react-native';
import { useAppStore } from '@/stores/app';
import { registerPushTokenIfGranted } from './push';

export type PermissionKind = 'location' | 'notifications';
export type PermissionState = 'granted' | 'undetermined' | 'denied' | 'blocked';

export async function getPermissionState(kind: PermissionKind): Promise<PermissionState> {
  const r = kind === 'location' ? await Location.getForegroundPermissionsAsync() : await Notifications.getPermissionsAsync();
  if (r.granted) return 'granted';
  if (r.status === 'undetermined') return 'undetermined';
  return r.canAskAgain ? 'denied' : 'blocked';
}

/** Ouvre la popup système (à n'appeler qu'après l'écran d'explication). */
export async function requestSystemPermission(kind: PermissionKind): Promise<boolean> {
  useAppStore.getState().markPermissionAsked(kind);
  if (kind === 'location') {
    const r = await Location.requestForegroundPermissionsAsync();
    return r.granted;
  }
  if (Platform.OS === 'web') return false;
  const r = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
  if (r.granted) void registerPushTokenIfGranted();
  return r.granted;
}

export function openSystemSettings() {
  void Linking.openSettings();
}

let pending: ((granted: boolean) => void) | null = null;

/**
 * Demande contextuelle : montre d'abord l'écran d'explication `/autorisation/[kind]`,
 * puis la popup système si l'utilisateur accepte. Renvoie false si refus → mode dégradé.
 *
 * ```ts
 * if (await askPermission('location', 'Pour trouver les artisans proches de chez vous')) { ... }
 * ```
 */
export async function askPermission(kind: PermissionKind, reason?: string): Promise<boolean> {
  const state = await getPermissionState(kind);
  if (state === 'granted') return true;
  if (state === 'blocked') return false;
  pending?.(false);
  return new Promise<boolean>((resolve) => {
    pending = resolve;
    router.push({ pathname: '/autorisation/[kind]', params: { kind, ...(reason ? { reason } : {}) } });
  });
}

/** Appelé par l'écran d'explication quand il se ferme. */
export function settlePermissionPrompt(granted: boolean) {
  pending?.(granted);
  pending = null;
}

/** Centre de Marseille : position par défaut en mode dégradé (localisation refusée). */
export const MARSEILLE = { lat: 43.2965, lng: 5.3698 } as const;

export interface UserPosition {
  lat: number;
  lng: number;
  /** true si la position est approximative (refus, échec) : proposer la saisie d'adresse. */
  approximate: boolean;
}

/** Position courante, avec demande contextuelle si nécessaire et repli sur Marseille. */
export async function getUserPosition(opts: { ask?: boolean; reason?: string } = {}): Promise<UserPosition> {
  const granted = opts.ask ? await askPermission('location', opts.reason) : (await getPermissionState('location')) === 'granted';
  if (!granted) return { ...MARSEILLE, approximate: true };
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
    const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { lat: pos.coords.latitude, lng: pos.coords.longitude, approximate: false };
  } catch {
    return { ...MARSEILLE, approximate: true };
  }
}
