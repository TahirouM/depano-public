/**
 * Logique pure (sans React Native) qui décide si l'on rend du Liquid Glass ou une surface opaque.
 * Testée dans `support.test.ts` ; le hook `useLiquidGlass` ne fait que brancher les sondes natives.
 */

export interface GlassEnvironment {
  /** `Platform.OS`. */
  platform: string;
  /** `isLiquidGlassAvailable()` : système iOS 26+, compilé avec Xcode 26, pas de mode compatibilité. */
  liquidGlassAvailable: boolean;
  /** `isGlassEffectAPIAvailable()` : l'API existe vraiment (certaines bêtas d'iOS 26 plantaient). */
  glassEffectApiAvailable: boolean;
  /**
   * Réglage « Réduire la transparence ». `null` tant que la valeur n'est pas connue :
   * on reste alors sur la surface opaque (pas de verre qui disparaît une fraction de seconde après).
   */
  reduceTransparency: boolean | null;
}

/** true seulement si toutes les conditions du verre sont réunies. Sinon : surface opaque + élévation. */
export function canUseLiquidGlass(env: GlassEnvironment): boolean {
  return env.platform === 'ios' && env.liquidGlassAvailable && env.glassEffectApiAvailable && env.reduceTransparency === false;
}

/** Appelle une sonde native sans jamais faire planter l'app (module absent, web, Android…). */
export function probe(fn: (() => boolean) | undefined): boolean {
  if (!fn) return false;
  try {
    return fn() === true;
  } catch {
    return false;
  }
}

/** `#RRGGBB` (ou `#RGB`) → `rgba(r, g, b, a)`. Renvoie la couleur telle quelle si elle n'est pas hexadécimale. */
export function hexWithAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  let h = m[1]!;
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const n = Number.parseInt(h, 16);
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export interface ReduceTransparencySource {
  /** Lecture initiale (AccessibilityInfo.isReduceTransparencyEnabled). */
  read: () => Promise<boolean>;
  /** Abonnement aux changements (événement `reduceTransparencyChanged`). Renvoie la désinscription. */
  listen: (cb: (enabled: boolean) => void) => () => void;
}

export interface ReduceTransparencyStore {
  get: () => boolean | null;
  subscribe: (onChange: () => void) => () => void;
}

/**
 * Store partagé (un seul écouteur natif pour toute l'app) compatible `useSyncExternalStore`.
 * Sans source (web, Android, iOS < 26) : la valeur vaut `false` d'emblée (aucun verre de toute façon).
 */
export function createReduceTransparencyStore(source: ReduceTransparencySource | null): ReduceTransparencyStore {
  if (!source) return { get: () => false, subscribe: () => () => undefined };
  let value: boolean | null = null;
  let started = false;
  const subscribers = new Set<() => void>();
  const set = (v: boolean) => {
    if (v === value) return;
    value = v;
    subscribers.forEach((s) => s());
  };
  const start = () => {
    if (started) return;
    started = true;
    try {
      source.listen(set);
      source.read().then(set, () => set(false));
    } catch {
      set(false);
    }
  };
  return {
    get: () => {
      start();
      return value;
    },
    subscribe: (onChange) => {
      start();
      subscribers.add(onChange);
      return () => subscribers.delete(onChange);
    },
  };
}
