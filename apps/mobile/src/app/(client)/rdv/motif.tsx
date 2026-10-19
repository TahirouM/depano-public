import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Rendez-vous · Motif — à implémenter par l'agent client (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="client"
      title="Rendez-vous · Motif"
      description="Étape 2 sur 4 : liste des prestations + détail, photo facultative."
      states="—"
      links={[{ label: "Étape suivante : créneau", href: "/rdv/creneau" }]}
    />
  );
}
