import { useLocalSearchParams } from 'expo-router';
import { RdvConfirmationScreen } from '@/features/client/rdv/RdvConfirmationScreen';

export default function Screen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  return <RdvConfirmationScreen bookingId={bookingId} />;
}
