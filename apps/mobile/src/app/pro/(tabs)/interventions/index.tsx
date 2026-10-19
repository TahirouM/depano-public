import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Interventions — à implémenter par l'agent artisan (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="artisan"
      title="Interventions"
      description="Liste du jour par statut, navigation semaine (bookings.list as=artisan)."
      states="vide" inTabs
      links={[{ label: "Détail intervention (démo)", href: "/pro/interventions/demo" }]}
    />
  );
}
