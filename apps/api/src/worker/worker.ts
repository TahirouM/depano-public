import 'reflect-metadata';
import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Queue, Worker } from 'bullmq';
import { QUEUES } from '@depano/schemas';
import { CoreModule } from '../core.module';
import { getEnv } from '../config/env';
import { createRedis } from '../infra/redis';
import { StorageService } from '../infra/storage';
import { DEFAULT_JOB_OPTIONS, type QueueName } from '../infra/jobs';
import { createProcessors, REPEATABLE_JOBS } from './processors';

@Module({ imports: [CoreModule] })
export class WorkerModule {}

const CONCURRENCY: Record<QueueName, number> = {
  dispatch: 10,
  notifications: 20,
  bookings: 5,
  files: 3,
  invoices: 2,
  maintenance: 1,
};

/** Démarre les workers BullMQ de toutes les files (process séparé : @depano/worker). */
export async function bootstrapWorker() {
  const env = getEnv();
  const logger = new Logger('Worker');
  const app = await NestFactory.createApplicationContext(WorkerModule, { logger: ['log', 'warn', 'error'] });
  await app.get(StorageService).ensureBucket().catch((e) => logger.warn(`Bucket S3 indisponible : ${e}`));
  const processors = createProcessors(app);
  const connection = createRedis(env.REDIS_URL, { forBullmq: true });
  const workers = (Object.values(QUEUES) as QueueName[]).map((name) => {
    const w = new Worker(name, async (job) => processors[name]({ name: job.name, data: job.data as never }), { connection, concurrency: CONCURRENCY[name] });
    w.on('completed', (job, result) => logger.log(`✔ ${name}/${job.name} ${job.id} ${result ? JSON.stringify(result).slice(0, 200) : ''}`));
    w.on('failed', (job, err) => logger.error(`✖ ${name}/${job?.name} ${job?.id} (essai ${job?.attemptsMade}) : ${err.message}`));
    return w;
  });
  const maintenance = new Queue(QUEUES.maintenance, { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS.maintenance });
  for (const r of REPEATABLE_JOBS) {
    await maintenance.upsertJobScheduler(r.id, { pattern: r.pattern, tz: 'Europe/Paris' }, { name: r.name, data: {} });
  }
  logger.log(`Workers démarrés : ${Object.values(QUEUES).join(', ')}`);

  const shutdown = async (signal: string) => {
    logger.log(`${signal} reçu, arrêt des workers…`);
    await Promise.all(workers.map((w) => w.close()));
    await maintenance.close();
    await connection.quit().catch(() => undefined);
    await app.close();
    process.exit(0);
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
  return { app, workers };
}
