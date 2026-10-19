import type { AuthResult } from '@depano/schemas';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { completeSignIn, finishAuthFlow } from '@/lib/session';

export function deviceName(): string {
  return (Device.deviceName ?? Device.modelName ?? `${Platform.OS} device`).slice(0, 100);
}

/** Après OTP / Apple / Google : prénom-nom si manquants, choix du rôle si nouveau compte. */
export function continueAfterAuth(result: AuthResult) {
  completeSignIn(result);
  if (!result.user.firstName || !result.user.lastName) {
    router.replace({ pathname: '/identite', params: result.isNewUser ? { nouveau: '1' } : {} });
  } else if (result.isNewUser) {
    router.replace('/role');
  } else {
    finishAuthFlow();
  }
}

/** Formatage lisible d'un numéro E.164 français (+33 6 12 34 56 78). */
export function formatPhone(e164: string): string {
  const m = /^\+33(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(e164);
  return m ? `+33 ${m.slice(1).join(' ')}` : e164;
}
