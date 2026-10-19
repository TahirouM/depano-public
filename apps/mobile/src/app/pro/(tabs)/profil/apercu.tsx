import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Profil public — à implémenter par l'agent artisan (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="artisan"
      title="Profil public"
      description={"Aperçu « vu client » (AccentScope accent=\"client\" + ArtisanCard), réalisations, tarifs, avis."}
      states="—" inTabs
    />
  );
}
