import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { getEnv } from './config/env';
import { createHttpApp } from './http';
import { StorageService } from './infra/storage';
import { RedisIoAdapter } from './modules/realtime/redis-io.adapter';

async function bootstrap() {
  const env = getEnv();
  const app = await createHttpApp();
  const adapter = new RedisIoAdapter(app, env.REDIS_URL);
  await adapter.connect();
  app.useWebSocketAdapter(adapter);
  await app.get(StorageService).ensureBucket().catch((e) => Logger.warn(`Bucket S3 indisponible : ${e}`, 'Bootstrap'));
  await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
  Logger.log(`API DEPANO sur http://localhost:${env.API_PORT}/v1 — docs : /docs`, 'Bootstrap');
}

bootstrap().catch((e) => {
  console.error(e);
  process.exit(1);
});
