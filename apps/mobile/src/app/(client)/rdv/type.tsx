import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Rendez-vous · Type — à implémenter par l'agent client (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="client"
      title="Rendez-vous · Type"
      description="Étape 1 sur 4 : entretien / dépannage. Brouillon : useDraft(DRAFT_KEYS.scheduled(artisanId))."
      states="—"
      links={[{ label: "Étape suivante : motif", href: "/rdv/motif" }]}
    />
  );
}
