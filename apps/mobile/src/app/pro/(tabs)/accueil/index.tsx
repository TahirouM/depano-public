import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Accueil — à implémenter par l'agent artisan (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="artisan"
      title="Accueil"
      description="Interrupteur « Disponible pour urgences », prochaine intervention, demandes en attente, résumé du jour (artisan.dashboard)."
      states="compte non validé" inTabs
      links={[{ label: "Demande d'urgence (démo)", href: "/pro/offre/demo" }, { label: "Devenir artisan (KYC)", href: "/pro/onboarding" }]}
    />
  );
}
