import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export * as schema from './schema';
export * from './schema';
export { sql, eq, and, or, not, inArray, notInArray, isNull, isNotNull, desc, asc, gt, gte, lt, lte, ne, count, ilike } from 'drizzle-orm';

export type Database = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
export type DbOrTx = Database | Tx;

export function createDb(url = process.env.DATABASE_URL, opts: { max?: number } = {}) {
  if (!url) throw new Error('DATABASE_URL manquant');
  const client = postgres(url, { max: opts.max ?? 10, prepare: false, onnotice: () => {} });
  const db = drizzle(client, { schema, casing: 'snake_case' });
  return { db, client, close: () => client.end() };
}
