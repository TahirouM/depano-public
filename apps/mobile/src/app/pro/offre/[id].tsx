import { useLocalSearchParams } from 'expo-router';
import { OfferScreen } from '@/features/artisan/offer/OfferScreen';

/** Demande d'urgence plein écran (ouverte automatiquement sur offer.created). */
export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OfferScreen offerId={id} />;
}
