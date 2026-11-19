import { Redirect, useSegments } from 'expo-router';
import { FlowStack } from '@/components/TabStack';
import { features } from '@/lib/env';

/**
 * Parcours urgence. Drapeau désactivé (features.urgent) : tout lien profond renvoie à l'accueil, sauf le
 * suivi en direct `[bookingId]/suivi`, partagé avec les rendez-vous (artisan en route).
 */
export default function Layout() {
  const segments = useSegments() as string[];
  if (!features.urgent && segments[segments.length - 1] !== 'suivi') return <Redirect href="/accueil" />;
  return <FlowStack />;
}
