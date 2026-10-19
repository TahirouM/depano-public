import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Recherche d'un artisan — à implémenter par l'agent client (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="client"
      title="Recherche d'un artisan"
      description="Animation, compteur, « 3 artisans contactés » (useBookingLive : booking.dispatch). Demander les notifications ici (askPermission('notifications'))."
      states="aucun preneur après X min"
      links={[{ label: "Suivi en direct (démo)", href: "/urgence/demo/suivi" }]}
    />
  );
}
