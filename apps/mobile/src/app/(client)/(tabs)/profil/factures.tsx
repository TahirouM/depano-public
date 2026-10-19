import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Factures — à implémenter par l'agent client (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="client"
      title="Factures"
      description="Factures (me.invoices), téléchargement PDF."
      states="vide" inTabs
    />
  );
}
