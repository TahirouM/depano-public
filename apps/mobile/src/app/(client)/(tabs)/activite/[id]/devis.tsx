import { useLocalSearchParams } from 'expo-router';
import { QuoteScreen } from '@/features/client/activity/QuoteScreen';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <QuoteScreen id={id} />;
}
