import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Code de fin — à implémenter par l'agent artisan (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="artisan"
      title="Code de fin"
      description="Clavier OTP 4 chiffres (OtpInput length={4}) → bookings.complete ; haptique de succès."
      states="code faux (3 essais)" inTabs
    />
  );
}
