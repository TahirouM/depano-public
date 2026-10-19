import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Recherche — à implémenter par l'agent client (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="client"
      title="Recherche"
      description="Liste + carte des artisans, filtres en bottom sheet (domaine, dispo aujourd'hui, note, prix)."
      states="aucun résultat" inTabs
      links={[{ label: "Fiche artisan (démo)", href: "/artisan/demo" }]}
    />
  );
}
