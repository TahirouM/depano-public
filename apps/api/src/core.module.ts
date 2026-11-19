import { Global, Module, type Provider } from '@nestjs/common';
import { AppConfig } from './config/config.service';
import { DbConnection } from './infra/db';
import { RateLimiter, RedisConnection } from './infra/redis';
import { BullJobsService, JobsService } from './infra/jobs';
import { RealtimeService, RedisRealtimeService } from './infra/realtime';
import { StorageService } from './infra/storage';
import { CALL_RELAY_PROVIDER, PAYMENT_PROVIDER, PUSH_PROVIDER, SMS_PROVIDER } from './infra/tokens';
import { FakePaymentProvider } from './providers/fake-payment.provider';
import { StripePaymentProvider } from './providers/stripe-payment.provider';
import {
  ConsolePushProvider,
  ConsoleSmsProvider,
  ExpoPushProvider,
  FakeCallRelayProvider,
  TwilioProxyCallRelayProvider,
  TwilioSmsProvider,
} from './providers/messaging.providers';
import { TokenService } from './modules/auth/token.service';
import { AuthService } from './modules/auth/auth.service';
import { FilesService } from './modules/files/files.service';
import { NotificationsService } from './modules/notifications/notifications.service';
import { ChatService } from './modules/chat/chat.service';
import { BookingStateService } from './modules/bookings/booking-state.service';
import { BookingMapper } from './modules/bookings/booking-mapper.service';
import { BookingsService } from './modules/bookings/bookings.service';
import { CompletionCodeService } from './modules/bookings/completion-code.service';
import { PaymentsService } from './modules/payments/payments.service';
import { SlotsService } from './modules/catalog/slots.service';
import { ReviewsService } from './modules/catalog/reviews.service';
import { CatalogService } from './modules/catalog/catalog.service';
import { DispatchService } from './modules/dispatch/dispatch.service';
import { MeService } from './modules/me/me.service';
import { ArtisanService } from './modules/artisan/artisan.service';
import { AdminService } from './modules/admin/admin.service';
import { AuditService } from './modules/admin/audit.service';
import { InvoicesService } from './modules/invoices/invoices.service';
import { MaintenanceService } from './modules/maintenance/maintenance.service';
import { ReliabilityService } from './modules/maintenance/reliability.service';
import { ReferralService } from './modules/me/referral.service';
import { PromotionService } from './modules/artisan/promotion.service';

/** Prestataires externes, sélectionnés par variables d'environnement. */
const externalProviders: Provider[] = [
  {
    provide: PAYMENT_PROVIDER,
    inject: [AppConfig],
    useFactory: (c: AppConfig) => (c.env.PAYMENT_PROVIDER === 'stripe' ? new StripePaymentProvider(c) : new FakePaymentProvider()),
  },
  {
    provide: SMS_PROVIDER,
    inject: [AppConfig],
    useFactory: (c: AppConfig) => (c.env.SMS_PROVIDER === 'twilio' ? new TwilioSmsProvider(c) : new ConsoleSmsProvider()),
  },
  {
    provide: PUSH_PROVIDER,
    inject: [AppConfig],
    useFactory: (c: AppConfig) => (c.env.PUSH_PROVIDER === 'expo' ? new ExpoPushProvider(c) : new ConsolePushProvider()),
  },
  {
    provide: CALL_RELAY_PROVIDER,
    inject: [AppConfig],
    useFactory: (c: AppConfig) => (c.env.TWILIO_PROXY_SERVICE_SID ? new TwilioProxyCallRelayProvider(c) : new FakeCallRelayProvider()),
  },
];

/** Services métier : une seule implémentation, partagée par l'API HTTP et les workers. */
export const DOMAIN_SERVICES = [
  TokenService,
  AuthService,
  FilesService,
  NotificationsService,
  ChatService,
  BookingStateService,
  BookingMapper,
  BookingsService,
  CompletionCodeService,
  PaymentsService,
  SlotsService,
  ReviewsService,
  CatalogService,
  DispatchService,
  MeService,
  ArtisanService,
  AdminService,
  AuditService,
  InvoicesService,
  MaintenanceService,
  ReliabilityService,
  ReferralService,
  PromotionService,
];

@Global()
@Module({
  providers: [
    AppConfig,
    DbConnection,
    RedisConnection,
    RateLimiter,
    StorageService,
    { provide: JobsService, useClass: BullJobsService },
    { provide: RealtimeService, useClass: RedisRealtimeService },
    ...externalProviders,
    ...DOMAIN_SERVICES,
  ],
  exports: [
    AppConfig,
    DbConnection,
    RedisConnection,
    RateLimiter,
    StorageService,
    JobsService,
    RealtimeService,
    PAYMENT_PROVIDER,
    SMS_PROVIDER,
    PUSH_PROVIDER,
    CALL_RELAY_PROVIDER,
    ...DOMAIN_SERVICES,
  ],
})
export class CoreModule {}
