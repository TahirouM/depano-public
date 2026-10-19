import 'reflect-metadata';
import { Logger, type Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

/** Crée l'application HTTP (Fastify, préfixe /v1, CORS, OpenAPI sur /docs). */
export async function createHttpApp(module: Type<unknown> = AppModule, opts: { logger?: boolean } = {}): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    module,
    new FastifyAdapter({ trustProxy: true, bodyLimit: 1024 * 1024 }),
    { rawBody: true, bufferLogs: false, logger: opts.logger === false ? false : ['log', 'warn', 'error'] },
  );
  app.setGlobalPrefix('v1');
  app.enableCors({ origin: true, credentials: true });
  app.enableShutdownHooks();
  const config = new DocumentBuilder()
    .setTitle('DEPANO API')
    .setDescription("API REST de DEPANO (dépannage à domicile). Erreurs : { statusCode, code, message, details? }.")
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config), { jsonDocumentUrl: 'docs/openapi.json' });
  Logger.log('Application HTTP initialisée', 'Bootstrap');
  return app;
}
