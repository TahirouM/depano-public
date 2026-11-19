import { useLocalSearchParams } from 'expo-router';
import { ReviewScreen } from '@/features/client/activity/ReviewScreen';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ReviewScreen id={id} backHref={{ pathname: '/interventions/[id]', params: { id } }} />;
}
