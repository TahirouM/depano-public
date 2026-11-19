import { useLocalSearchParams } from 'expo-router';
import { CompletedInterventionScreen } from '@/features/client/activity/CompletedInterventionScreen';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CompletedInterventionScreen id={id} />;
}
