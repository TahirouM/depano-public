import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Retour haptique sur les validations clés (paiement, code de fin, urgence envoyée). */
export type HapticKind = 'selection' | 'light' | 'medium' | 'success' | 'warning' | 'error';

export function haptic(kind: HapticKind = 'light'): void {
  if (Platform.OS === 'web') return;
  const run = async () => {
    switch (kind) {
      case 'selection':
        return Haptics.selectionAsync();
      case 'light':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case 'medium':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case 'success':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case 'warning':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      case 'error':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };
  run().catch(() => undefined);
}
