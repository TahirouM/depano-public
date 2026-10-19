import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { createDb, type Database } from '@depano/db';
import { AppConfig } from '../config/config.service';

/** Connexion Postgres partagée (Drizzle + postgres.js). */
@Injectable()
export class DbConnection implements OnApplicationShutdown {
  readonly db: Database;
  readonly client: ReturnType<typeof createDb>['client'];
  private readonly closeFn: () => Promise<void>;

  constructor(@Inject(AppConfig) config: AppConfig) {
    const { db, client, close } = createDb(config.env.DATABASE_URL, { max: config.isTest ? 10 : 20 });
    this.db = db;
    this.client = client;
    this.closeFn = close;
  }

  async onApplicationShutdown() {
    await this.closeFn();
  }
}
