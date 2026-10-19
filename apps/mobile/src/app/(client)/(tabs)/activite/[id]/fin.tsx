import { useLocalSearchParams } from 'expo-router';
import { EndScreen } from '@/features/client/activity/EndScreen';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EndScreen id={id} />;
}
