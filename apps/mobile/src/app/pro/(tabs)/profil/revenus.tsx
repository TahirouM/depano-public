import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Revenus — à implémenter par l'agent artisan (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="artisan"
      title="Revenus"
      description="Solde, virements, commission, export comptable (artisan.earnings)."
      states="aucun gain" inTabs
    />
  );
}
