import { Redirect, useLocalSearchParams } from 'expo-router';
import { OfferScreen } from '@/features/artisan/offer/OfferScreen';
import { features } from '@/lib/env';

/**
 * Demande d'urgence plein écran (ouverte automatiquement sur offer.created).
 * Urgences désactivées (`features.urgent`) : lien profond / notification renvoient à l'accueil.
 */
export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!features.urgent) return <Redirect href="/pro/accueil" />;
  return <OfferScreen offerId={id} />;
}
