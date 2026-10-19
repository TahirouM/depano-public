import { useLocalSearchParams } from 'expo-router';
import { RdvRecapScreen } from '@/features/client/rdv/RdvRecapScreen';

export default function Screen() {
  const { artisanId } = useLocalSearchParams<{ artisanId: string }>();
  return <RdvRecapScreen artisanId={artisanId} />;
}
