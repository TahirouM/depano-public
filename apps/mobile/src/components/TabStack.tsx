import { Stack } from 'expo-router';
import { HeaderBell } from './HeaderBell';
import { useStackOptions } from './navigation';

/** Pile de navigation d'un onglet : chaque onglet garde son historique. */
export function TabStack({ rootTitle, bell = true }: { rootTitle: string; bell?: boolean }) {
  const options = useStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: rootTitle, headerRight: bell ? () => <HeaderBell /> : undefined }} />
    </Stack>
  );
}

/** Pile d'un parcours plein écran (urgence, RDV, onboarding pro) : pas de tab bar. */
export function FlowStack() {
  const options = useStackOptions();
  return <Stack screenOptions={{ ...options, gestureEnabled: true }} />;
}
