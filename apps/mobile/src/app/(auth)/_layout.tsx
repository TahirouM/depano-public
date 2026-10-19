import { IconButton } from '@depano/ui';
import { router, Stack } from 'expo-router';
import { X } from 'lucide-react-native';
import { useStackOptions } from '@/components/navigation';
import { useAuthStore } from '@/stores/auth';

/** Parcours de connexion présenté en modale au-dessus de l'écran d'origine. */
export default function AuthLayout() {
  const options = useStackOptions();
  const close = () => {
    useAuthStore.getState().setReturnTo(null);
    if (router.canGoBack()) router.back();
    else router.replace('/accueil');
  };
  return (
    <Stack screenOptions={{ ...options, title: '' }}>
      <Stack.Screen name="connexion" options={{ headerLeft: () => <IconButton icon={X} accessibilityLabel="Fermer" onPress={close} /> }} />
      <Stack.Screen name="code" />
      <Stack.Screen name="identite" options={{ headerBackVisible: false, headerLeft: () => null, gestureEnabled: false }} />
      <Stack.Screen name="role" options={{ headerBackVisible: false, headerLeft: () => null, gestureEnabled: false }} />
      <Stack.Screen name="autorisations" />
    </Stack>
  );
}
