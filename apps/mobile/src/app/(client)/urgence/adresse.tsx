import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Urgence · Adresse — à implémenter par l'agent client (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="client"
      title="Urgence · Adresse"
      description="Étape 3 sur 4 : adresse pré-remplie (getUserPosition + catalog.reverseGeocode), étage, digicode, accès."
      states="hors zone"
      links={[{ label: "Étape suivante : prix et paiement", href: "/urgence/paiement" }]}
    />
  );
}
