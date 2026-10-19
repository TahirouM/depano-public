import { useLocalSearchParams } from 'expo-router';
import { CodeScreen } from '@/features/artisan/interventions/CodeScreen';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CodeScreen id={id} />;
}
