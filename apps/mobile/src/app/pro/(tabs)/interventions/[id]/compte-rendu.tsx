import { useLocalSearchParams } from 'expo-router';
import { ReportScreen } from '@/features/artisan/interventions/ReportScreen';

export default function Screen() {
  const { id, deplacement } = useLocalSearchParams<{ id: string; deplacement?: string }>();
  return <ReportScreen id={id} travelOnly={deplacement === '1'} />;
}
