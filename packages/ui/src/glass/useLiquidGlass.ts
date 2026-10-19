import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { canUseLiquidGlass, createReduceTransparencyStore, probe, type ReduceTransparencyStore } from './support';

let available: boolean | undefined;
let store: ReduceTransparencyStore | undefined;

/**
 * Liquid Glass compilé et disponible sur cet appareil (iOS 26+, Xcode 26, pas de
 * `UIDesignRequiresCompatibility`, API présente). Indépendant du réglage d'accessibilité.
 * Sûr sur web et Android (expo-glass-effect y renvoie `false`).
 */
export function isLiquidGlassSupported(): boolean {
  if (available === undefined) {
    available = Platform.OS === 'ios' && probe(isLiquidGlassAvailable) && probe(isGlassEffectAPIAvailable);
  }
  return available;
}

function getStore(): ReduceTransparencyStore {
  if (!store) {
    store = createReduceTransparencyStore(
      isLiquidGlassSupported()
        ? {
            read: () => AccessibilityInfo.isReduceTransparencyEnabled(),
            listen: (cb) => {
              const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', cb);
              return () => sub.remove();
            },
          }
        : null,
    );
  }
  return store;
}

const subscribe = (onChange: () => void) => getStore().subscribe(onChange);
const getSnapshot = () => getStore().get();

export interface LiquidGlassState {
  /** Rendre du verre maintenant (disponible ET « Réduire la transparence » désactivé). */
  enabled: boolean;
  /** Le système sait dessiner du Liquid Glass (iOS 26+). */
  available: boolean;
  /** « Réduire la transparence » (iOS) ; `null` tant que la valeur n'est pas lue. */
  reduceTransparency: boolean | null;
}

/** État Liquid Glass courant, mis à jour quand l'utilisateur change « Réduire la transparence ». */
export function useLiquidGlass(): LiquidGlassState {
  const reduceTransparency = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const isAvailable = isLiquidGlassSupported();
  return {
    available: isAvailable,
    reduceTransparency,
    enabled: canUseLiquidGlass({
      platform: Platform.OS,
      liquidGlassAvailable: isAvailable,
      glassEffectApiAvailable: isAvailable,
      reduceTransparency,
    }),
  };
}
