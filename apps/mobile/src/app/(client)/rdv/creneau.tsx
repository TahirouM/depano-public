import { useLocalSearchParams } from 'expo-router';
import { RdvSlotScreen } from '@/features/client/rdv/RdvSlotScreen';

export default function Screen() {
  const { artisanId } = useLocalSearchParams<{ artisanId: string }>();
  return <RdvSlotScreen artisanId={artisanId} />;
}
