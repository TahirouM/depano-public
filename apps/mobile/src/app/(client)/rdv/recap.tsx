import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Rendez-vous · Récapitulatif — à implémenter par l'agent client (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="client"
      title="Rendez-vous · Récapitulatif"
      description="Étape 4 sur 4 : récap, adresse, conditions d'annulation (« Annulation gratuite jusqu'à 2 h avant »), empreinte bancaire, total TTC."
      states="—"
      links={[{ label: "Confirmation", href: "/rdv/confirmation" }]}
    />
  );
}
