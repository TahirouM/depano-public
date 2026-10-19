import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Devenir artisan — à implémenter par l'agent artisan (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="artisan"
      title="Devenir artisan"
      description="Onboarding pro (KYC) : checklist de progression (KycChecklistDto), délai annoncé 48 h ouvrées."
      states="en attente de validation, refusé"
      links={[{ label: "SIRET", href: "/pro/onboarding/siret" }, { label: "Métiers et tarifs", href: "/pro/onboarding/metiers" }, { label: "Zone et horaires", href: "/pro/onboarding/zone" }, { label: "Documents et IBAN", href: "/pro/onboarding/documents" }, { label: "Vérification", href: "/pro/onboarding/verification" }]}
    />
  );
}
