import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { Queue, type JobsOptions } from 'bullmq';
import {
  QUEUES,
  type BookingJobs,
  type DispatchJobs,
  type FileJobs,
  type InvoiceJobs,
  type MaintenanceJobs,
  type NotificationJobs,
} from '@depano/schemas';
import { AppConfig } from '../config/config.service';
import { createRedis } from './redis';

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
export interface JobMap {
  dispatch: DispatchJobs;
  notifications: NotificationJobs;
  bookings: BookingJobs;
  files: FileJobs;
  invoices: InvoiceJobs;
  maintenance: MaintenanceJobs;
}

export interface EnqueueOptions {
  delayMs?: number;
  /** Identifiant unique (sans « : ») : évite les doublons. */
  jobId?: string;
  attempts?: number;
}

/** Abstraction des files BullMQ (remplacée par une implémentation mémoire dans les tests). */
export abstract class JobsService {
  abstract add<Q extends QueueName, N extends keyof JobMap[Q] & string>(
    queue: Q,
    name: N,
    data: JobMap[Q][N],
    opts?: EnqueueOptions,
  ): Promise<void>;
  abstract remove(queue: QueueName, jobId: string): Promise<void>;
}

export const DEFAULT_JOB_OPTIONS: Record<QueueName, JobsOptions> = {
  dispatch: { attempts: 3, backoff: { type: 'fixed', delay: 2000 }, removeOnComplete: 1000, removeOnFail: 5000 },
  notifications: { attempts: 5, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 1000, removeOnFail: 5000 },
  bookings: { attempts: 5, backoff: { type: 'exponential', delay: 10_000 }, removeOnComplete: 1000, removeOnFail: 5000 },
  files: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 1000, removeOnFail: 5000 },
  invoices: { attempts: 5, backoff: { type: 'exponential', delay: 10_000 }, removeOnComplete: 1000, removeOnFail: 5000 },
  maintenance: { attempts: 2, removeOnComplete: 100, removeOnFail: 500 },
};

@Injectable()
export class BullJobsService extends JobsService implements OnApplicationShutdown {
  private readonly logger = new Logger('Jobs');
  private readonly connection;
  private readonly queues = new Map<QueueName, Queue>();

  constructor(@Inject(AppConfig) config: AppConfig) {
    super();
    this.connection = createRedis(config.env.REDIS_URL, { forBullmq: true });
  }

  queue(name: QueueName) {
    let q = this.queues.get(name);
    if (!q) {
      q = new Queue(name, { connection: this.connection, defaultJobOptions: DEFAULT_JOB_OPTIONS[name] });
      this.queues.set(name, q);
    }
    return q;
  }

  async add(queue: QueueName, name: string, data: unknown, opts: EnqueueOptions = {}) {
    await this.queue(queue).add(name, data, {
      ...(opts.delayMs && opts.delayMs > 0 ? { delay: Math.round(opts.delayMs) } : {}),
      ...(opts.jobId ? { jobId: opts.jobId } : {}),
      ...(opts.attempts ? { attempts: opts.attempts } : {}),
    });
    this.logger.debug(`+ ${queue}/${name} ${JSON.stringify(data)}`);
  }

  async remove(queue: QueueName, jobId: string) {
    await this.queue(queue).remove(jobId).catch(() => undefined);
  }

  async onApplicationShutdown() {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
    await this.connection.quit().catch(() => undefined);
  }
}
