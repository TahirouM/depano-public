import { useLocalSearchParams } from 'expo-router';
import { ActivityScreen } from '@/features/artisan/account/ActivityScreen';

export default function Screen() {
  const { onglet } = useLocalSearchParams<{ onglet?: string }>();
  return <ActivityScreen initialTab={onglet === 'avis' ? 'reviews' : undefined} />;
}
