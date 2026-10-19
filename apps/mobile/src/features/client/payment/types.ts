/** Session à présenter : empreinte (PaymentIntent), enregistrement de carte (SetupIntent). */
export interface PaymentSheetInput {
  provider: 'stripe' | 'fake';
  clientSecret: string;
  /** true si clientSecret est celui d'un SetupIntent (carte enregistrée pour plus tard). */
  setup?: boolean;
  customerId?: string | null;
  ephemeralKey?: string | null;
  amountCents?: number;
}

export type PaymentSheetResult = { status: 'succeeded' } | { status: 'cancelled' } | { status: 'failed'; message: string };

export interface PaymentSheetApi {
  /** Présente la feuille de paiement (Stripe) ou simule la validation (fake). */
  present: (input: PaymentSheetInput) => Promise<PaymentSheetResult>;
}

/** Délai de la simulation « fake » : laisse voir l'état de chargement. */
export const FAKE_DELAY_MS = 700;

export function fakePresent(): Promise<PaymentSheetResult> {
  return new Promise((resolve) => setTimeout(() => resolve({ status: 'succeeded' }), FAKE_DELAY_MS));
}
