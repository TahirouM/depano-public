import type { INestApplicationContext } from '@nestjs/common';
import { QUEUES } from '@depano/schemas';
import type { JobMap, QueueName } from '../infra/jobs';
import { DispatchService } from '../modules/dispatch/dispatch.service';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { BookingsService } from '../modules/bookings/bookings.service';
import { FilesService } from '../modules/files/files.service';
import { InvoicesService } from '../modules/invoices/invoices.service';
import { MaintenanceService } from '../modules/maintenance/maintenance.service';

export interface JobLike<Q extends QueueName = QueueName> {
  name: string;
  data: JobMap[Q][keyof JobMap[Q]];
}
export type Processor = (job: JobLike) => Promise<unknown>;

/**
 * Traitement des jobs : simple aiguillage vers les services métier (logique dans l'API).
 * Utilisé par le worker BullMQ et appelé directement par les tests.
 */
export function createProcessors(app: Pick<INestApplicationContext, 'get'>): Record<QueueName, Processor> {
  const dispatch = app.get(DispatchService);
  const notifications = app.get(NotificationsService);
  const bookings = app.get(BookingsService);
  const files = app.get(FilesService);
  const invoices = app.get(InvoicesService);
  const maintenance = app.get(MaintenanceService);
  const unknown = (q: string, n: string) => {
    throw new Error(`Job inconnu ${q}/${n}`);
  };
  return {
    [QUEUES.dispatch]: async (job) => {
      const d = job.data as any;
      if (job.name === 'start') return dispatch.start(d.bookingId);
      if (job.name === 'wave-timeout') return dispatch.waveTimeout(d.bookingId, d.wave);
      return unknown('dispatch', job.name);
    },
    [QUEUES.notifications]: async (job) => {
      const d = job.data as any;
      if (job.name === 'push') return notifications.deliverPush(d);
      if (job.name === 'sms') return notifications.deliverSms(d);
      return unknown('notifications', job.name);
    },
    [QUEUES.bookings]: async (job) => {
      const d = job.data as any;
      switch (job.name) {
        case 'auto-capture':
          return bookings.autoCapture(d.bookingId);
        case 'reminder':
          return bookings.reminder(d.bookingId, d.kind);
        case 'authorize-scheduled':
          return bookings.authorizeScheduled(d.bookingId);
        case 'quote-expire':
          return bookings.expireQuote(d.bookingId, d.quoteId);
        case 'request-expire':
          return bookings.expireRequest(d.bookingId);
        default:
          return unknown('bookings', job.name);
      }
    },
    [QUEUES.files]: async (job) => {
      if (job.name === 'thumbnail') return files.generateThumbnail((job.data as any).fileId);
      return unknown('files', job.name);
    },
    [QUEUES.invoices]: async (job) => {
      if (job.name === 'generate') return invoices.generate((job.data as any).bookingId);
      return unknown('invoices', job.name);
    },
    [QUEUES.maintenance]: async (job) => {
      if (job.name === 'document-expiry') return maintenance.documentExpiry();
      if (job.name === 'data-retention') return maintenance.dataRetention();
      if (job.name === 'reliability') return maintenance.reliabilitySweep();
      if (job.name === 'promotion-renew') return maintenance.promotionRenewal();
      return unknown('maintenance', job.name);
    },
  } as Record<QueueName, Processor>;
}

/** Tâches récurrentes (fuseau Europe/Paris). */
export const REPEATABLE_JOBS = [
  { id: 'document-expiry-daily', name: 'document-expiry', pattern: '0 3 * * *' },
  { id: 'data-retention-daily', name: 'data-retention', pattern: '30 3 * * *' },
  { id: 'reliability-hourly', name: 'reliability', pattern: '15 * * * *' },
  { id: 'promotion-renew-hourly', name: 'promotion-renew', pattern: '45 * * * *' },
] as const;
