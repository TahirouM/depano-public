import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

/**
 * URL de l'API (sans /v1). `localhost` n'est pas joignable depuis un appareil physique
 * ni depuis l'émulateur Android : on le remplace par l'IP du serveur Metro / 10.0.2.2.
 */
function resolveApiUrl(): string {
  const raw = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  if (!/\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(raw) || Platform.OS === 'web') return raw;
  const hostUri = Constants.expoConfig?.hostUri; // ex. « 192.168.1.20:8081 »
  const devHost = hostUri?.split(':')[0];
  if (Device.isDevice && devHost && devHost !== 'localhost') return raw.replace(/localhost|127\.0\.0\.1/, devHost);
  if (Platform.OS === 'android') return raw.replace(/localhost|127\.0\.0\.1/, '10.0.2.2');
  return raw;
}

export const env = {
  apiUrl: resolveApiUrl(),
  appVersion: Constants.expoConfig?.version ?? '0.0.0',
  google: {
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
  },
  /** ID de projet EAS (requis pour les jetons push Expo). */
  easProjectId: (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ?? Constants.easConfig?.projectId,
} as const;

/** Drapeaux de fonctionnalités : une fonctionnalité sans configuration reste masquée. */
export const features = {
  googleSignIn: Platform.select({
    ios: !!env.google.iosClientId,
    android: !!env.google.androidClientId,
    default: !!env.google.webClientId,
  }),
  appleSignIn: Platform.OS === 'ios',
  /** Passkeys : endpoints présents côté API, UI à venir (expo-passkeys / module natif). */
  passkeys: false,
} as const;
