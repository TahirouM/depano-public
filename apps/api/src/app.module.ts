import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { CoreModule } from './core.module';
import { ApiExceptionFilter } from './common/error.filter';
import { ArtisanGuard, JwtAuthGuard, RolesGuard } from './common/guards';
import { AuthController } from './modules/auth/auth.controller';
import { MeController } from './modules/me/me.controller';
import { CatalogController } from './modules/catalog/catalog.controller';
import { BookingsController, ReviewsController } from './modules/bookings/bookings.controller';
import { ArtisanController } from './modules/artisan/artisan.controller';
import { FilesController } from './modules/files/files.controller';
import { ChatController } from './modules/chat/chat.controller';
import { NotificationsController } from './modules/notifications/notifications.controller';
import { AdminController } from './modules/admin/admin.controller';
import { WebhooksController } from './modules/payments/webhooks.controller';
import { HealthController } from './modules/health/health.controller';
import { RealtimeGateway } from './modules/realtime/realtime.gateway';

@Module({
  imports: [CoreModule],
  controllers: [
    HealthController,
    AuthController,
    MeController,
    CatalogController,
    BookingsController,
    ReviewsController,
    ArtisanController,
    FilesController,
    ChatController,
    NotificationsController,
    AdminController,
    WebhooksController,
  ],
  providers: [
    RealtimeGateway,
    // Ordre : authentification, rôles, puis profil artisan.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ArtisanGuard },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
