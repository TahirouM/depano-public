import type { PaymentMethodDto } from '@depano/schemas';

export type IntentState = 'requires_action' | 'authorized' | 'succeeded' | 'cancelled' | 'failed' | 'setup_succeeded';

export interface IntentResult {
  id: string;
  clientSecret: string;
  status: IntentState;
}

export interface PromotionSubscriptionResult {
  /** Identifiant de l'abonnement chez le prestataire. */
  ref: string;
  /** active : période payée immédiatement ; requires_action : première facture à régler dans l'app. */
  status: 'active' | 'requires_action';
  paymentIntentId: string | null;
  clientSecret: string | null;
  /** Fin de la période en cours, si le prestataire la connaît déjà. */
  currentPeriodEnd: Date | null;
}

export interface WebhookEvent {
  id: string;
  type: string;
  object: Record<string, any>;
  raw: unknown;
}

/**
 * Prestataire de paiement (Stripe Connect Express en production).
 * Empreinte bancaire : PaymentIntent capture_method=manual, capture à la saisie du code de fin.
 */
export interface PaymentProvider {
  readonly name: 'stripe' | 'fake';
  ensureCustomer(user: { id: string; email: string | null; phone: string | null; name: string | null; customerId: string | null }): Promise<string>;
  createAuthorization(input: {
    bookingId: string;
    kind: 'authorization' | 'supplement';
    amountCents: number;
    customerId: string;
    destinationAccountId?: string | null;
    paymentMethodId?: string | null;
    offSession?: boolean;
    description?: string;
  }): Promise<IntentResult>;
  createSetupIntent(input: { customerId: string; bookingId?: string }): Promise<IntentResult>;
  createEphemeralKey(customerId: string): Promise<string | null>;
  getIntent(id: string): Promise<{ status: IntentState; amountCapturableCents: number; paymentMethodId: string | null; clientSecret?: string | null }>;
  capture(id: string, input: { amountCents: number; applicationFeeCents: number; destinationAccountId?: string | null; bookingId: string }): Promise<void>;
  cancel(id: string): Promise<void>;
  refund(id: string, amountCents?: number): Promise<void>;
  listPaymentMethods(customerId: string): Promise<PaymentMethodDto[]>;
  detachPaymentMethod(customerId: string, paymentMethodId: string): Promise<void>;
  createConnectedAccount(input: { artisanId: string; email: string | null; companyName: string | null }): Promise<string>;
  createAccountLink(accountId: string, returnUrl: string, refreshUrl: string): Promise<string>;
  getAccount(accountId: string): Promise<{ payoutsEnabled: boolean }>;
  getBalance(accountId: string): Promise<{ availableCents: number; pendingCents: number } | null>;
  listPayouts(accountId: string): Promise<{ id: string; amountCents: number; status: string; arrivalDate: string | null }[]>;
  /** Abonnement « Promouvoir mon compte » (facturé à l'artisan, hors intervention). */
  createPromotionSubscription(input: { customerId: string; artisanId: string; priceCents: number; periodDays: number }): Promise<PromotionSubscriptionResult>;
  /** Renouvellement automatique : false = résiliation en fin de période, true = reprise. */
  setPromotionAutoRenew(ref: string, autoRenew: boolean): Promise<void>;
  parseWebhook(rawBody: Buffer, signature: string | undefined): WebhookEvent;
}
