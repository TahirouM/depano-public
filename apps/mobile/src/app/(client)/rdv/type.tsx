import { useLocalSearchParams } from 'expo-router';
import { RdvTypeScreen } from '@/features/client/rdv/RdvTypeScreen';

export default function Screen() {
  const { artisanId } = useLocalSearchParams<{ artisanId: string }>();
  return <RdvTypeScreen artisanId={artisanId} />;
}
