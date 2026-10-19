/** Point d'entrée bibliothèque de @depano/api (utilisé par @depano/worker). */
export { bootstrapWorker, WorkerModule } from './worker/worker';
export { createProcessors, REPEATABLE_JOBS } from './worker/processors';
export { CoreModule } from './core.module';
export { AppModule } from './app.module';
export { createHttpApp } from './http';
