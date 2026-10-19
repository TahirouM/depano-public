import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** SIRET — à implémenter par l'agent artisan (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="artisan"
      title="SIRET"
      description="Saisie du SIRET : nom, adresse et activité pré-remplis (artisan.lookupSiret)."
      states="SIRET inactif, APE incohérent"
    />
  );
}
