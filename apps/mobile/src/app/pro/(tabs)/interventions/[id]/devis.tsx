import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Devis sur place — à implémenter par l'agent artisan (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="artisan"
      title="Devis sur place"
      description="Lignes main-d'œuvre et pièces, total TTC, envoi au client (bookings.sendQuote) — devis obligatoire avant travaux."
      states="refusé" inTabs
    />
  );
}
