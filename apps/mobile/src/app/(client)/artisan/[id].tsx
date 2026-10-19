import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Fiche artisan — à implémenter par l'agent client (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="client"
      title="Fiche artisan"
      description="Photo, note, avis, tarifs par prestation, réalisations, zone, badges (SIRET vérifié, assuré), prochaines dispos ; CTA « Prendre rendez-vous » collé en bas."
      states="indisponible"
      links={[{ label: "Prendre rendez-vous", href: "/rdv/type?artisanId=demo" }]}
    />
  );
}
