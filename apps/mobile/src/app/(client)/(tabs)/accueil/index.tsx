import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Accueil — à implémenter par l'agent client (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="client"
      title="Accueil"
      description="Bouton urgence (1 tap, rouge urgent), recherche, domaines, artisans dispo près de moi, intervention en cours épinglée."
      states="aucun artisan dans la zone" inTabs
      links={[{ label: "Urgence : choisir le métier", href: "/urgence/domaine" }, { label: "Fiche artisan (démo)", href: "/artisan/demo" }, { label: "Prendre rendez-vous", href: "/rdv/type?artisanId=demo" }]}
    />
  );
}
