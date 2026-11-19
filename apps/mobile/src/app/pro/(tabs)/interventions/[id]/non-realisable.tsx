import { useLocalSearchParams } from 'expo-router';
import { ReportScreen } from '@/features/artisan/interventions/ReportScreen';

/** Intervention non réalisable : motif, photos, puis reprogrammer ou annuler (déplacement facturé). */
export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ReportScreen id={id} notFeasible />;
}
