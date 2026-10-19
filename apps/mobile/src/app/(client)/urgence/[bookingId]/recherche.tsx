import { useLocalSearchParams } from 'expo-router';
import { UrgentSearchScreen } from '@/features/client/urgent/UrgentSearchScreen';

export default function Screen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  return <UrgentSearchScreen bookingId={bookingId} />;
}
