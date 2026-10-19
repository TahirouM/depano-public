import { Controller, HttpCode, Inject, Logger, Post, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { artisanProfiles, eq } from '@depano/db';
import { Public } from '../../common/auth';
import { badRequest } from '../../common/errors';
import { DbConnection } from '../../infra/db';
import { PaymentsService } from './payments.service';
import { BookingsService } from '../bookings/bookings.service';

/** Webhooks Stripe : signature vérifiée sur le corps brut, idempotence par identifiant d'événement. */
@ApiExcludeController()
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger('Webhooks');

  constructor(
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(BookingsService) private readonly bookings: BookingsService,
    @Inject(DbConnection) private readonly conn: DbConnection,
  ) {}

  @Public()
  @Post('stripe')
  @HttpCode(200)
  async stripe(@Req() req: FastifyRequest & { rawBody?: Buffer }) {
    if (!req.rawBody) throw badRequest('invalid_webhook', 'Corps de requête manquant.');
    const event = this.payments.provider.parseWebhook(req.rawBody, req.headers['stripe-signature'] as string | undefined);
    if (!(await this.payments.recordWebhook('stripe', event.id, event.type, event.raw))) return { received: true, duplicate: true };
    try {
      await this.handle(event.type, event.object);
      await this.payments.markWebhook(event.id);
    } catch (e) {
      this.logger.error(`webhook ${event.type} ${event.id} : ${e}`);
      await this.payments.markWebhook(event.id, String(e));
      throw e;
    }
    return { received: true };
  }

  private async handle(type: string, o: Record<string, any>) {
    switch (type) {
      case 'payment_intent.amount_capturable_updated':
      case 'payment_intent.succeeded': {
        await this.payments.markAuthorized(o.id, typeof o.payment_method === 'string' ? o.payment_method : null);
        const bookingId = await this.payments.bookingIdForRef(o.id);
        if (bookingId) await this.bookings.confirmPayment(null, bookingId).catch(() => undefined);
        break;
      }
      case 'setup_intent.succeeded': {
        await this.payments.markAuthorized(o.id, typeof o.payment_method === 'string' ? o.payment_method : null);
        const bookingId = await this.payments.bookingIdForRef(o.id);
        if (bookingId) await this.bookings.confirmPayment(null, bookingId).catch(() => undefined);
        break;
      }
      case 'payment_intent.payment_failed':
        await this.payments.markFailed(o.id, o.last_payment_error?.message ?? null);
        break;
      case 'account.updated':
        await this.conn.db.update(artisanProfiles).set({ payoutsEnabled: !!o.payouts_enabled }).where(eq(artisanProfiles.stripeAccountId, o.id));
        break;
      default:
        break;
    }
  }
}
