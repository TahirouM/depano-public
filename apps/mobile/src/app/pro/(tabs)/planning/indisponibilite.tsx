import { useLocalSearchParams } from 'expo-router';
import { UnavailabilityScreen } from '@/features/artisan/planning/UnavailabilityScreen';

export default function Screen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  return <UnavailabilityScreen date={date} />;
}
