import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Urgence · Motif — à implémenter par l'agent client (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="client"
      title="Urgence · Motif"
      description="Étape 2 sur 4 : motifs prédéfinis + texte + photo/vocal (uploadFile purpose problem_photo / problem_voice)."
      states="—"
      links={[{ label: "Étape suivante : adresse", href: "/urgence/adresse" }]}
    />
  );
}
