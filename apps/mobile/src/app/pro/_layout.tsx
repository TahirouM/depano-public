import { Redirect, Stack } from 'expo-router';
import { useStackOptions } from '@/components/navigation';
import { useIsSignedIn } from '@/lib/query/hooks';

/** Espace artisan : réservé aux comptes connectés. */
export default function ArtisanLayout() {
  const options = useStackOptions();
  const signedIn = useIsSignedIn();
  if (!signedIn) return <Redirect href="/connexion" />;
  return (
    <Stack screenOptions={{ ...options, headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="offre/[id]" options={{ presentation: 'fullScreenModal', gestureEnabled: false, headerShown: true, title: "Demande d'urgence" }} />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
