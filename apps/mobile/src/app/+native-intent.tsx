import { resolveDeepLink } from '@/lib/deepLinks';
import { waitForStoresHydration } from '@/lib/hydration';
import { useAppStore } from '@/stores/app';

/**
 * Liens système (SMS, notifications, liens universels) : depano://intervention/{id}…
 * réécrits vers la route de l'espace actif (client ou artisan).
 */
export async function redirectSystemPath({ path }: { path: string; initial: boolean }): Promise<string> {
  try {
    await waitForStoresHydration();
    return resolveDeepLink(path, useAppStore.getState().activeRole) ?? '/';
  } catch {
    return '/';
  }
}
