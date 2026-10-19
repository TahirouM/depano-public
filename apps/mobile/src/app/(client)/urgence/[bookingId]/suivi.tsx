import { useLocalSearchParams } from 'expo-router';
import { UrgentTrackingScreen } from '@/features/client/urgent/UrgentTrackingScreen';

export default function Screen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  return <UrgentTrackingScreen bookingId={bookingId} />;
}
