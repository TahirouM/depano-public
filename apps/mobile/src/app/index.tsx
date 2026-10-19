import { Redirect } from 'expo-router';
import { useIsSignedIn } from '@/lib/query/hooks';
import { useAppStore } from '@/stores/app';

/** Aiguillage de démarrage : onboarding (1re fois) → espace actif. Accueil accessible sans compte. */
export default function Index() {
  const onboardingSeen = useAppStore((s) => s.onboardingSeen);
  const role = useAppStore((s) => s.activeRole);
  const signedIn = useIsSignedIn();
  if (!onboardingSeen) return <Redirect href="/onboarding" />;
  if (role === 'artisan' && signedIn) return <Redirect href="/pro/accueil" />;
  return <Redirect href="/accueil" />;
}
