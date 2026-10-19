import { useLocalSearchParams } from 'expo-router';
import { RdvMotifScreen } from '@/features/client/rdv/RdvMotifScreen';

export default function Screen() {
  const { artisanId } = useLocalSearchParams<{ artisanId: string }>();
  return <RdvMotifScreen artisanId={artisanId} />;
}
