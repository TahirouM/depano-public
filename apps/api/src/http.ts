import 'reflect-metadata';
import { Logger, type Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

export const CORS_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
export const CORS_ALLOWED_HEADERS = ['Authorization', 'Content-Type', 'Accept'];

/**
 * Réglages HTTP communs (app réelle et tests) : préfixe /v1, CORS (toutes les méthodes du contrat) et parseur JSON
 * qui accepte un corps vide (`Content-Type: application/json` sans contenu ⇒ `{}`). À appeler avant `init()`.
 */
export function configureHttpApp(app: NestFastifyApplication): NestFastifyApplication {
  app.setGlobalPrefix('v1');
  app.enableCors({ origin: true, credentials: true, methods: CORS_METHODS, allowedHeaders: CORS_ALLOWED_HEADERS, maxAge: 600 });
  const fastify = app.getHttpAdapter().getInstance();
  const { bodyLimit, onProtoPoisoning, onConstructorPoisoning } = fastify.initialConfig;
  const parseJson = fastify.getDefaultJsonParser(onProtoPoisoning ?? 'error', onConstructorPoisoning ?? 'error');
  app.useBodyParser('application/json', { bodyLimit }, (req, body, done) => {
    if (body.length === 0 || body.toString('utf8').trim() === '') return done(null, {});
    parseJson(req as never, body.toString('utf8'), done);
  });
  return app;
}

/** Crée l'application HTTP (Fastify, préfixe /v1, CORS, OpenAPI sur /docs). */
export async function createHttpApp(module: Type<unknown> = AppModule, opts: { logger?: boolean } = {}): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    module,
    new FastifyAdapter({ trustProxy: true, bodyLimit: 1024 * 1024 }),
    { rawBody: true, bufferLogs: false, logger: opts.logger === false ? false : ['log', 'warn', 'error'] },
  );
  configureHttpApp(app);
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
