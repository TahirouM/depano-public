import { useMemo } from 'react';
import { fakePresent, type PaymentSheetApi, type PaymentSheetInput, type PaymentSheetResult } from './types';

export type { PaymentSheetInput, PaymentSheetResult } from './types';

let stripeReady: Promise<void> | null = null;

async function presentStripe(input: PaymentSheetInput): Promise<PaymentSheetResult> {
  const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) return { status: 'failed', message: 'Paiement indisponible : configuration Stripe manquante.' };
  // Chargé à la demande : le module natif n'est sollicité qu'avec le prestataire Stripe.
  const stripe = await import('@stripe/stripe-react-native');
  stripeReady ??= stripe.initStripe({ publishableKey, merchantIdentifier: 'merchant.fr.depano.app', urlScheme: 'depano' });
  await stripeReady;
  const intent = input.setup ? { setupIntentClientSecret: input.clientSecret } : { paymentIntentClientSecret: input.clientSecret };
  const customer =
    input.customerId && input.ephemeralKey ? { customerId: input.customerId, customerEphemeralKeySecret: input.ephemeralKey } : {};
  const init = await stripe.initPaymentSheet({
    merchantDisplayName: 'DEPANO',
    returnURL: 'depano://stripe-redirect',
    applePay: { merchantCountryCode: 'FR' },
    googlePay: { merchantCountryCode: 'FR', testEnv: __DEV__ },
    defaultBillingDetails: { address: { country: 'FR' } },
    ...intent,
    ...customer,
  });
  if (init.error) return { status: 'failed', message: init.error.localizedMessage ?? init.error.message };
  const res = await stripe.presentPaymentSheet();
  if (res.error) {
    if (res.error.code === 'Canceled') return { status: 'cancelled' };
    return { status: 'failed', message: res.error.localizedMessage ?? res.error.message };
  }
  return { status: 'succeeded' };
}

/** PaymentSheet Stripe (Apple Pay / Google Pay / carte) ; simulation en mode « fake ». */
export function usePaymentSheet(): PaymentSheetApi {
  return useMemo<PaymentSheetApi>(
    () => ({
      present: async (input) => {
        if (input.provider === 'fake') return fakePresent();
        try {
          return await presentStripe(input);
        } catch (e) {
          return { status: 'failed', message: e instanceof Error ? e.message : 'Le paiement a échoué.' };
        }
      },
    }),
    [],
  );
}
