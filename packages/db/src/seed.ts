import 'dotenv/config';
import { createDb, sql } from './index';
import * as s from './schema';

/**
 * Données de démo (Marseille) reprenant les exemples de la maquette Figma.
 * Idempotent : vide les tables métier puis réinsère.
 * Connexion en dev : n'importe quel numéro ci-dessous, OTP affiché dans la console de l'API.
 */

const CATALOG: Record<'plomberie' | 'electricite' | 'energetique', [slug: string, name: string, kind: 'maintenance' | 'repair' | 'both', price: number, minutes: number, urgent: boolean][]> = {
  plomberie: [
    ['fuite-eau', "Recherche et réparation de fuite d'eau", 'repair', 9000, 60, true],
    ['debouchage', 'Débouchage canalisation / WC', 'repair', 8500, 60, true],
    ['chauffe-eau-panne', 'Dépannage chauffe-eau / ballon', 'repair', 11000, 90, true],
    ['robinetterie', 'Remplacement robinet / mitigeur', 'repair', 7500, 45, false],
    ['chasse-eau', "Réparation chasse d'eau", 'repair', 6500, 45, false],
    ['entretien-chauffe-eau', 'Détartrage chauffe-eau', 'maintenance', 12000, 90, false],
  ],
  electricite: [
    ['panne-courant', 'Panne de courant / disjoncteur', 'repair', 9500, 60, true],
    ['prise-interrupteur', 'Remplacement prise ou interrupteur', 'repair', 6000, 30, false],
    ['tableau-electrique', 'Mise en sécurité tableau électrique', 'repair', 18000, 180, false],
    ['luminaire', 'Pose de luminaire', 'repair', 6500, 45, false],
    ['diagnostic-elec', 'Diagnostic installation électrique', 'maintenance', 13000, 90, false],
  ],
  energetique: [
    ['chaudiere-panne', 'Dépannage chaudière gaz', 'repair', 12000, 90, true],
    ['entretien-chaudiere', 'Entretien annuel chaudière', 'maintenance', 11000, 60, false],
    ['clim-panne', 'Dépannage climatisation / PAC', 'repair', 13000, 90, true],
    ['entretien-clim', 'Entretien climatisation', 'maintenance', 9500, 60, false],
    ['radiateur', 'Purge et équilibrage radiateurs', 'maintenance', 8000, 60, false],
  ],
};

const ARTISANS = [
  { first: 'Karim', last: 'Benali', company: 'KB Plomberie', phone: '+33600000101', domains: ['plomberie'], city: 'Marseille 5e', lat: 43.2925, lng: 5.3986, rating: 4.9, count: 128, urgent: true, quals: [] as string[] },
  { first: 'Sophie', last: 'Martin', company: 'Martin Élec', phone: '+33600000102', domains: ['electricite'], city: 'Marseille 8e', lat: 43.2629, lng: 5.3827, rating: 4.8, count: 86, urgent: true, quals: ['Qualifelec'] },
  { first: 'Julien', last: 'Roux', company: 'Roux Thermique', phone: '+33600000103', domains: ['energetique', 'plomberie'], city: 'Marseille 4e', lat: 43.3065, lng: 5.4007, rating: 4.7, count: 64, urgent: true, quals: ['RGE', 'Qualigaz'] },
  { first: 'Nadia', last: 'Haddad', company: 'Haddad Services', phone: '+33600000104', domains: ['plomberie', 'electricite'], city: 'Marseille 1er', lat: 43.2999, lng: 5.3811, rating: 4.6, count: 41, urgent: false, quals: [] },
  { first: 'Thomas', last: 'Garcia', company: 'Garcia Clim', phone: '+33600000105', domains: ['energetique'], city: 'Aix-en-Provence', lat: 43.5297, lng: 5.4474, rating: 4.9, count: 152, urgent: true, quals: ['RGE'] },
  { first: 'Lucas', last: 'Moreau', company: 'LM Électricité', phone: '+33600000106', domains: ['electricite'], city: 'Marseille 13e', lat: 43.3486, lng: 5.4339, rating: 4.5, count: 23, urgent: true, quals: [] },
];

async function main() {
  const { db, close } = createDb(process.env.DATABASE_URL, { max: 1 });

  await db.execute(sql`TRUNCATE TABLE audit_logs, files, notifications, messages, conversations, invoices, webhook_events,
    payments, reviews, disputes, intervention_reports, quote_lines, quotes, dispatch_offers, booking_locations,
    booking_events, bookings, favorites, addresses, availability_exceptions, availability_rules, artisan_documents,
    artisan_services, artisan_profiles, services, domains, zones, consents, push_tokens, passkeys, sessions,
    otp_codes, client_profiles, users CASCADE`);

  await db.insert(s.zones).values({ name: 'Marseille & Aix', centerLat: 43.39, centerLng: 5.42, radiusKm: 35, commissionRate: 0.15 });

  await db.insert(s.domains).values([
    { code: 'plomberie', name: 'Plomberie', icon: 'droplet', sortOrder: 1 },
    { code: 'electricite', name: 'Électricité', icon: 'zap', sortOrder: 2 },
    { code: 'energetique', name: 'Énergétique', icon: 'flame', sortOrder: 3 },
  ]);

  const serviceRows = await db
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
    .returning();

  const [admin] = await db
    .insert(s.users)
    .values({ phone: '+33600000001', phoneVerifiedAt: new Date(), firstName: 'Admin', lastName: 'DEPANO', email: 'admin@depano.fr', roles: ['admin', 'support'], activeRole: 'client' })
    .returning();
  await db.insert(s.users).values({ phone: '+33600000002', phoneVerifiedAt: new Date(), firstName: 'Support', lastName: 'DEPANO', roles: ['support'] });

  const [client] = await db
    .insert(s.users)
    .values({ phone: '+33600000010', phoneVerifiedAt: new Date(), firstName: 'Camille', lastName: 'Durand', email: 'camille@example.fr', roles: ['client'] })
    .returning();
  await db.insert(s.clientProfiles).values({ userId: client!.id, referralCode: 'CAMILLE10' });
  await db.insert(s.addresses).values({ userId: client!.id, label: 'Domicile', line1: '12 rue Paradis', postalCode: '13001', city: 'Marseille', floor: '3e', doorCode: 'A1234', lat: 43.2951, lng: 5.3772, isDefault: true });

  for (const a of ARTISANS) {
    const [u] = await db
      .insert(s.users)
      .values({ phone: a.phone, phoneVerifiedAt: new Date(), firstName: a.first, lastName: a.last, roles: ['client', 'artisan'], activeRole: 'artisan' })
      .returning();
    const [p] = await db
      .insert(s.artisanProfiles)
      .values({
        userId: u!.id,
        status: 'approved',
        siret: String(80000000000000 + Math.floor(Math.random() * 9999999999)).slice(0, 14),
        companyName: a.company,
        companyAddress: `${a.city}`,
        apeCode: a.domains[0] === 'electricite' ? '43.21A' : '43.22A',
        companyActive: true,
        displayName: `${a.first} ${a.last[0]}.`,
        bio: `Artisan ${a.domains.join(' & ')} depuis plus de 10 ans à ${a.city}. Intervention rapide, devis clair avant travaux.`,
        domains: a.domains as ('plomberie' | 'electricite' | 'energetique')[],
        qualifications: a.quals,
        baseLat: a.lat,
        baseLng: a.lng,
        baseCity: a.city,
        radiusKm: 20,
        travelFeeCents: 2500,
        urgentAvailable: a.urgent,
        currentLat: a.urgent ? a.lat : null,
        currentLng: a.urgent ? a.lng : null,
        currentLocationAt: a.urgent ? new Date() : null,
        ratingAvg: a.rating,
        ratingCount: a.count,
        completedCount: a.count + 12,
        offersReceived: 100,
        offersAccepted: 88,
        payoutsEnabled: true,
        submittedAt: new Date(Date.now() - 30 * 86400_000),
        approvedAt: new Date(Date.now() - 28 * 86400_000),
        approvedBy: admin!.id,
      })
      .returning();
    const mine = serviceRows.filter((sv) => a.domains.includes(sv.domain));
    await db.insert(s.artisanServices).values(
      mine.map((sv) => ({ artisanId: p!.id, serviceId: sv.id, priceCents: sv.referencePriceCents + Math.round((Math.random() - 0.5) * 2000), durationMinutes: sv.defaultDurationMinutes })),
    );
    await db.insert(s.availabilityRules).values(
      [1, 2, 3, 4, 5].flatMap((weekday) => [
        { artisanId: p!.id, weekday, startTime: '08:00', endTime: '12:00' },
        { artisanId: p!.id, weekday, startTime: '14:00', endTime: '19:00' },
      ]).concat([{ artisanId: p!.id, weekday: 6, startTime: '09:00', endTime: '13:00' }]),
    );
  }

  // Un artisan en cours de vérification, pour le back-office
  const [pending] = await db
    .insert(s.users)
    .values({ phone: '+33600000199', phoneVerifiedAt: new Date(), firstName: 'Mehdi', lastName: 'Saidi', roles: ['client', 'artisan'], activeRole: 'artisan' })
    .returning();
  await db.insert(s.artisanProfiles).values({
    userId: pending!.id, status: 'pending_review', siret: '91234567800012', companyName: 'MS Dépannage', apeCode: '43.22A', companyActive: true,
    displayName: 'Mehdi S.', domains: ['plomberie'], baseLat: 43.28, baseLng: 5.36, baseCity: 'Marseille 6e', submittedAt: new Date(),
  });

  console.log(`✔ seed : ${serviceRows.length} prestations, ${ARTISANS.length + 1} artisans, client ${client!.phone}, admin ${admin!.phone}`);
  await close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
