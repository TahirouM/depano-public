import { useEffect, useState } from 'react';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useDraftsStore } from '@/stores/drafts';
import { useOutboxStore } from '@/stores/outbox';

const stores = [useAuthStore, useAppStore, useDraftsStore, useOutboxStore];

/** Résout quand tous les stores persistés sont relus (SecureStore / AsyncStorage). */
export function waitForStoresHydration(): Promise<void> {
  return Promise.all(
    stores.map(
      (s) =>
        new Promise<void>((resolve) => {
          if (s.persist.hasHydrated()) return resolve();
          const unsub = s.persist.onFinishHydration(() => {
            unsub();
            resolve();
          });
        }),
    ),
  ).then(() => undefined);
}

export function useStoresHydrated(): boolean {
  const [ready, setReady] = useState(() => stores.every((s) => s.persist.hasHydrated()));
  useEffect(() => {
    if (ready) return;
    let alive = true;
    void waitForStoresHydration().then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [ready]);
  return ready;
}
