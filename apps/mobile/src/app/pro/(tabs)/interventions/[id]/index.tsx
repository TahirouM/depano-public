import { useLocalSearchParams } from 'expo-router';
import { InterventionDetailScreen } from '@/features/artisan/interventions/InterventionDetailScreen';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <InterventionDetailScreen id={id} />;
}
