import { Stack } from 'expo-router';
import { useStackOptions } from '@/components/navigation';
import { nestedStackScreenOptions } from '@/components/TabStack';

export default function SettingsLayout() {
  const options = useStackOptions();
  return (
    <Stack screenOptions={nestedStackScreenOptions(options)}>
      <Stack.Screen name="index" options={{ title: 'Paramètres' }} />
      <Stack.Screen name="compte" options={{ title: 'Compte' }} />
      <Stack.Screen name="securite" options={{ title: 'Sécurité' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="legal" options={{ title: 'Informations légales' }} />
      <Stack.Screen name="aide" options={{ title: 'Aide' }} />
    </Stack>
  );
}
