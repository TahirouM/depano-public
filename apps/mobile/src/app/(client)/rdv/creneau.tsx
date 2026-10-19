import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Rendez-vous · Créneau — à implémenter par l'agent client (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="client"
      title="Rendez-vous · Créneau"
      description="Étape 3 sur 4 : SlotPicker (jours en scroll horizontal, créneaux en grille ; passés/pris masqués)."
      states="aucun créneau"
      links={[{ label: "Étape suivante : récapitulatif", href: "/rdv/recap" }]}
    />
  );
}
