import { onlineManager, useMutationState } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/** true si le réseau est disponible (NetInfo via onlineManager). */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,
  );
}

/** Nombre d'actions mises en file (mutations en pause hors ligne). */
export function usePausedMutationCount(): number {
  return useMutationState({ filters: { predicate: (m) => m.state.isPaused } }).length;
}
