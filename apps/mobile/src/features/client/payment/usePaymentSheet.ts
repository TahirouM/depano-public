import { useMemo } from 'react';
import { fakePresent, type PaymentSheetApi } from './types';

export type { PaymentSheetInput, PaymentSheetResult } from './types';

/**
 * Web : seul le prestataire « fake » (développement) est pris en charge.
 * La version native (usePaymentSheet.native.ts) présente la PaymentSheet Stripe.
 */
export function usePaymentSheet(): PaymentSheetApi {
  return useMemo<PaymentSheetApi>(
    () => ({
      present: async (input) => {
        if (input.provider === 'fake') return fakePresent();
        return { status: 'failed', message: "Le paiement par carte se fait depuis l'application mobile DEPANO." };
      },
    }),
    [],
  );
}
