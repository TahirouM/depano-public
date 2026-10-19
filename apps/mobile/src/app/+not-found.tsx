import { EmptyState, Screen } from '@depano/ui';
import { router } from 'expo-router';
import { MapPinOff } from 'lucide-react-native';

export default function NotFound() {
  return (
    <Screen>
      <EmptyState
        fill
        icon={MapPinOff}
        title="Cette page n'existe pas"
        message="Le lien est peut-être ancien. Revenez à l'accueil pour continuer."
        action={{ label: "Retour à l'accueil", onPress: () => router.replace('/') }}
      />
    </Screen>
  );
}
