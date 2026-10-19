import { Inject, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { AppConfig } from '../config/config.service';
import { badRequest } from '../common/errors';
import type { IntentState, PaymentProvider, WebhookEvent } from './payment.provider';

function mapPi(status: Stripe.PaymentIntent.Status): IntentState {
  switch (status) {
    case 'requires_capture':
      return 'authorized';
    case 'succeeded':
      return 'succeeded';
    case 'canceled':
      return 'cancelled';
    case 'requires_payment_method':
    case 'requires_confirmation':
    case 'requires_action':
    case 'processing':
    default:
      return 'requires_action';
  }
}

/** Stripe Connect Express : empreinte (capture manuelle), commission via application_fee_amount. */
@Injectable()
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe' as const;
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(@Inject(AppConfig) config: AppConfig) {
    this.stripe = new Stripe(config.env.STRIPE_SECRET_KEY);
    this.webhookSecret = config.env.STRIPE_WEBHOOK_SECRET;
  }

  async ensureCustomer(user: { id: string; email: string | null; phone: string | null; name: string | null; customerId: string | null }) {
    if (user.customerId) return user.customerId;
    const c = await this.stripe.customers.create({
      email: user.email ?? undefined,
      phone: user.phone ?? undefined,
      name: user.name ?? undefined,
      metadata: { userId: user.id },
    });
    return c.id;
  }

  async createAuthorization(input: {
    bookingId: string;
    kind: 'authorization' | 'supplement';
    amountCents: number;
    customerId: string;
    destinationAccountId?: string | null;
    paymentMethodId?: string | null;
    offSession?: boolean;
    description?: string;
  }) {
    const pi = await this.stripe.paymentIntents.create(
      {
        amount: input.amountCents,
        currency: 'eur',
        customer: input.customerId,
        capture_method: 'manual',
        automatic_payment_methods: input.offSession ? { enabled: true, allow_redirects: 'never' } : { enabled: true },
        payment_method: input.paymentMethodId ?? undefined,
        confirm: input.offSession ? true : undefined,
        off_session: input.offSession ? true : undefined,
        description: input.description,
        // Destination connue (RDV planifié) : transfert automatique à la capture.
        transfer_data: input.destinationAccountId ? { destination: input.destinationAccountId } : undefined,
        transfer_group: input.bookingId,
        metadata: { bookingId: input.bookingId, kind: input.kind },
      },
      { idempotencyKey: `${input.bookingId}:${input.kind}:${input.amountCents}:${Date.now()}` },
    );
    return { id: pi.id, clientSecret: pi.client_secret ?? '', status: mapPi(pi.status) };
  }

  async createSetupIntent(input: { customerId: string; bookingId?: string }) {
    const si = await this.stripe.setupIntents.create({
      customer: input.customerId,
      usage: 'off_session',
      automatic_payment_methods: { enabled: true },
      metadata: input.bookingId ? { bookingId: input.bookingId } : {},
    });
    return { id: si.id, clientSecret: si.client_secret ?? '', status: si.status === 'succeeded' ? ('setup_succeeded' as const) : ('requires_action' as const) };
  }

  async createEphemeralKey(customerId: string) {
    const k = await this.stripe.ephemeralKeys.create({ customer: customerId }, { apiVersion: '2025-01-27.acacia' });
    return k.secret ?? null;
  }

  async getIntent(id: string) {
    if (id.startsWith('seti_')) {
      const si = await this.stripe.setupIntents.retrieve(id);
      const pm = typeof si.payment_method === 'string' ? si.payment_method : (si.payment_method?.id ?? null);
      return { status: si.status === 'succeeded' ? ('setup_succeeded' as const) : ('requires_action' as const), amountCapturableCents: 0, paymentMethodId: pm };
    }
    const pi = await this.stripe.paymentIntents.retrieve(id);
    const pm = typeof pi.payment_method === 'string' ? pi.payment_method : (pi.payment_method?.id ?? null);
    return { status: mapPi(pi.status), amountCapturableCents: pi.amount_capturable, paymentMethodId: pm };
  }

  async capture(id: string, input: { amountCents: number; applicationFeeCents: number; destinationAccountId?: string | null; bookingId: string }) {
    const pi = await this.stripe.paymentIntents.retrieve(id);
    const hasDestination = !!pi.transfer_data?.destination;
    const captured = await this.stripe.paymentIntents.capture(id, {
      amount_to_capture: input.amountCents,
      ...(hasDestination ? { application_fee_amount: input.applicationFeeCents } : {}),
    });
    // Urgence : l'artisan n'était pas connu à la création, transfert séparé (charges & transferts séparés).
    if (!hasDestination && input.destinationAccountId && input.amountCents - input.applicationFeeCents > 0) {
      const charge = typeof captured.latest_charge === 'string' ? captured.latest_charge : captured.latest_charge?.id;
      await this.stripe.transfers.create({
        amount: input.amountCents - input.applicationFeeCents,
        currency: 'eur',
        destination: input.destinationAccountId,
        source_transaction: charge ?? undefined,
        transfer_group: input.bookingId,
        metadata: { bookingId: input.bookingId },
      });
    }
  }

  async cancel(id: string) {
    const pi = await this.stripe.paymentIntents.retrieve(id);
    if (['canceled', 'succeeded'].includes(pi.status)) return;
    await this.stripe.paymentIntents.cancel(id);
  }

  async refund(id: string, amountCents?: number) {
    await this.stripe.refunds.create({ payment_intent: id, amount: amountCents, reverse_transfer: true, refund_application_fee: true });
  }

  async listPaymentMethods(customerId: string) {
    const [customer, list] = await Promise.all([
      this.stripe.customers.retrieve(customerId),
      this.stripe.paymentMethods.list({ customer: customerId, type: 'card' }),
    ]);
    const def = 'deleted' in customer ? null : (customer.invoice_settings?.default_payment_method as string | null);
    return list.data.map((pm, i) => ({
      id: pm.id,
      brand: pm.card?.brand ?? 'card',
      last4: pm.card?.last4 ?? '????',
      expMonth: pm.card?.exp_month ?? 0,
      expYear: pm.card?.exp_year ?? 0,
      isDefault: def ? def === pm.id : i === 0,
    }));
  }

  async detachPaymentMethod(customerId: string, paymentMethodId: string) {
    const pm = await this.stripe.paymentMethods.retrieve(paymentMethodId);
    if (pm.customer !== customerId) throw badRequest('payment_method_not_found', 'Moyen de paiement introuvable.');
    await this.stripe.paymentMethods.detach(paymentMethodId);
  }

  async createConnectedAccount(input: { artisanId: string; email: string | null; companyName: string | null }) {
    const acct = await this.stripe.accounts.create({
      type: 'express',
      country: 'FR',
      email: input.email ?? undefined,
      business_type: 'individual',
      business_profile: { name: input.companyName ?? undefined, mcc: '1711' },
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { artisanId: input.artisanId },
    });
    return acct.id;
  }

  async createAccountLink(accountId: string, returnUrl: string, refreshUrl: string) {
    const link = await this.stripe.accountLinks.create({ account: accountId, type: 'account_onboarding', return_url: returnUrl, refresh_url: refreshUrl });
    return link.url;
  }

  async getAccount(accountId: string) {
    const a = await this.stripe.accounts.retrieve(accountId);
    return { payoutsEnabled: !!a.payouts_enabled };
  }

  async getBalance(accountId: string) {
    const b = await this.stripe.balance.retrieve({}, { stripeAccount: accountId });
    const sum = (l: { amount: number; currency: string }[]) => l.filter((x) => x.currency === 'eur').reduce((s, x) => s + x.amount, 0);
    return { availableCents: sum(b.available), pendingCents: sum(b.pending) };
  }

  async listPayouts(accountId: string) {
    const list = await this.stripe.payouts.list({ limit: 20 }, { stripeAccount: accountId });
    return list.data.map((p) => ({
      id: p.id,
      amountCents: p.amount,
      status: p.status,
      arrivalDate: p.arrival_date ? new Date(p.arrival_date * 1000).toISOString() : null,
    }));
  }

  parseWebhook(rawBody: Buffer, signature: string | undefined): WebhookEvent {
    if (!signature) throw badRequest('invalid_signature', 'Signature Stripe manquante.');
    try {
      const e = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
      return { id: e.id, type: e.type, object: e.data.object as unknown as Record<string, any>, raw: e };
    } catch {
      throw badRequest('invalid_signature', 'Signature Stripe invalide.');
    }
  }
}
