import { AccentTransition, haptic } from '@depano/ui';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { Me } from '@depano/schemas';
import { api } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import { useAppStore, type ActiveRole } from '@/stores/app';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const Ctx = createContext<(to: ActiveRole) => Promise<void>>(async () => undefined);

/**
 * Changement d'espace client ↔ artisan avec une transition de couleur plein écran
 * (évite de se tromper d'espace). Synchronise me.activeRole côté API.
 */
export function RoleSwitchProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [overlay, setOverlay] = useState<{ visible: boolean; to: ActiveRole }>({ visible: false, to: 'client' });

  const switchRole = useCallback(
    async (to: ActiveRole) => {
      haptic('medium');
      setOverlay({ visible: true, to });
      await wait(280);
      useAppStore.getState().setActiveRole(to);
      api.me
        .setActiveRole({ role: to })
        .then((me) => qc.setQueryData(qk.me, me))
        .catch(() => undefined);
      const me = qc.getQueryData<Me>(qk.me);
      if (to === 'artisan') {
        router.replace(me?.artisan && me.artisan.status !== 'draft' ? '/pro/accueil' : '/pro/onboarding');
      } else {
        router.replace('/accueil');
      }
      await wait(450);
      setOverlay({ visible: false, to });
    },
    [qc],
  );

  return (
    <Ctx.Provider value={switchRole}>
      {children}
      <AccentTransition visible={overlay.visible} accent={overlay.to} />
    </Ctx.Provider>
  );
}

/** `const switchRole = useSwitchRole(); switchRole('artisan')` */
export function useSwitchRole() {
  return useContext(Ctx);
}
