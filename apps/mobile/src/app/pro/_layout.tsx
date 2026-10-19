import { AccentScope } from '@depano/ui';
import { Redirect, Stack } from 'expo-router';
import { useStackOptions } from '@/components/navigation';
import { EnRouteTracker } from '@/features/artisan/tracking';
import { useIsSignedIn } from '@/lib/query/hooks';

/** Espace artisan : réservé aux comptes connectés, toujours à l'accent ardoise. */
export default function ArtisanLayout() {
  const signedIn = useIsSignedIn();
  if (!signedIn) return <Redirect href="/connexion" />;
  return (
    <AccentScope accent="artisan">
      {/* Partage de position pendant le trajet (« en route »), quel que soit l'écran. */}
      <EnRouteTracker />
      <ArtisanStack />
    </AccentScope>
  );
}

function ArtisanStack() {
  const options = useStackOptions();
  return (
    <Stack screenOptions={{ ...options, headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="offre/[id]"
        options={{
          presentation: 'fullScreenModal',
          gestureEnabled: false,
          headerShown: true,
          title: "Demande d'urgence",
        }}
      />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
