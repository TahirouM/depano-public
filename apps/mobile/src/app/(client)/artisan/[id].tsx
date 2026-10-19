import { useLocalSearchParams } from 'expo-router';
import { ArtisanProfileScreen } from '@/features/client/artisan/ArtisanProfileScreen';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ArtisanProfileScreen id={id} />;
}
