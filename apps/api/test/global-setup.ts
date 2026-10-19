import path from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

/** Crée la base depano_test (si besoin) et applique les migrations de @depano/db. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgres://depano:depano@localhost:5432/depano_test';
  const name = new URL(url).pathname.slice(1);
  const admin = postgres(url.replace(`/${name}`, '/postgres'), { max: 1, onnotice: () => {} });
  const exists = await admin`select 1 from pg_database where datname = ${name}`;
  if (!exists.length) await admin.unsafe(`create database "${name}"`);
  await admin.end();
  const client = postgres(url, { max: 1, onnotice: () => {} });
  await migrate(drizzle(client), { migrationsFolder: path.resolve(__dirname, '../../../packages/db/migrations') });
  await client.end();
}
