import { Stack } from 'expo-router';
import { useStackOptions } from '@/components/navigation';

/** Espace client : onglets + écrans plein écran (recherche, fiche artisan, parcours urgence et RDV). */
export default function ClientLayout() {
  const options = useStackOptions();
  return (
    <Stack screenOptions={{ ...options, headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="recherche" options={{ headerShown: true, title: 'Recherche' }} />
      <Stack.Screen name="artisan/[id]" options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="urgence" />
      <Stack.Screen name="rdv" />
    </Stack>
  );
}
