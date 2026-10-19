import { useLocalSearchParams } from 'expo-router';
import { QuoteScreen } from '@/features/artisan/interventions/QuoteScreen';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <QuoteScreen id={id} />;
}
