import { useLocalSearchParams } from 'expo-router';
import { InterventionDetailScreen } from '@/features/client/activity/InterventionDetailScreen';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <InterventionDetailScreen id={id} />;
}
