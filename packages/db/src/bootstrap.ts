import 'dotenv/config';
import { createDb, sql } from './index';
import * as s from './schema';
import { CATALOG } from './catalog';

/**
 * Initialisation d'un environnement réel (sans données de démo), idempotente :
 * zone, métiers, catalogue de prestations et compte administrateur.
 *   ADMIN_PHONE=+336XXXXXXXX pnpm --filter @depano/db bootstrap
 */
async function main() {
  const adminPhone = process.env.ADMIN_PHONE;
  if (!adminPhone || !/^\+\d{8,15}$/.test(adminPhone)) throw new Error('ADMIN_PHONE (format E.164, ex. +33612345678) est requis');
  const { db, close } = createDb(process.env.DATABASE_URL, { max: 1 });

  const [{ n: zoneCount }] = (await db.execute(sql`select count(*)::int as n from zones`)) as unknown as [{ n: number }];
  if (!zoneCount) await db.insert(s.zones).values({ name: 'Marseille & Aix', centerLat: 43.39, centerLng: 5.42, radiusKm: 35, commissionRate: 0.15 });

  await db
    .insert(s.domains)
    .values([
      { code: 'plomberie', name: 'Plomberie', icon: 'droplet', sortOrder: 1 },
      { code: 'electricite', name: 'Électricité', icon: 'zap', sortOrder: 2 },
      { code: 'energetique', name: 'Énergétique', icon: 'flame', sortOrder: 3 },
    ])
    .onConflictDoNothing();

  const inserted = await db
    .insert(s.services)
    .values(
      Object.entries(CATALOG).flatMap(([domain, list]) =>
        list.map(([slug, name, kind, price, minutes, urgent], i) => ({
          domain: domain as 'plomberie',
          slug,
          name,
          kind,
          referencePriceCents: price,
          defaultDurationMinutes: minutes,
          urgentEligible: urgent,
          sortOrder: i,
        })),
      ),
    )
    .onConflictDoNothing()
    .returning();

  const [existing] = await db.select({ id: s.users.id }).from(s.users).where(sql`${s.users.phone} = ${adminPhone} and ${s.users.deletedAt} is null`);
  if (existing) {
    await db
      .update(s.users)
      .set({ roles: sql`(select array_agg(distinct r) from unnest(${s.users.roles} || ARRAY['admin','support']::role[]) r)` })
      .where(sql`${s.users.id} = ${existing.id}`);
  } else {
    await db.insert(s.users).values({ phone: adminPhone, phoneVerifiedAt: new Date(), firstName: 'Admin', lastName: 'DEPANO', roles: ['client', 'admin', 'support'], activeRole: 'client' });
  }

  console.log(`✔ bootstrap : ${inserted.length} prestations ajoutées, admin ${adminPhone}`);
  await close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
