import { useLocalSearchParams } from 'expo-router';
import { EventScreen } from '@/features/artisan/planning/EventScreen';

/** Événement personnel du planning (ajout, ou modification avec `id`). */
export default function Screen() {
  const { date, id } = useLocalSearchParams<{ date?: string; id?: string }>();
  return <EventScreen date={date} id={id} />;
}
