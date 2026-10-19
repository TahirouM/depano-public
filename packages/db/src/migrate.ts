import 'dotenv/config';
import path from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDb } from './index';

async function main() {
  const { db, close } = createDb(process.env.DATABASE_URL, { max: 1 });
  const migrationsFolder = path.resolve(__dirname, '../migrations');
  await migrate(db, { migrationsFolder });
  await close();
  console.log('✔ migrations appliquées');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
