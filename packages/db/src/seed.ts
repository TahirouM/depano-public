import 'dotenv/config';
import { createDb, sql } from './index';
import * as s from './schema';
import { CATALOG } from './catalog';

/**
 * Données de démo (Marseille) reprenant les exemples de la maquette Figma.
 * Idempotent : vide les tables métier puis réinsère.
 * Connexion en dev : n'importe quel numéro ci-dessous, OTP affiché dans la console de l'API.
 */


const ARTISANS = [
  { first: 'Karim', last: 'Benali', company: 'KB Plomberie', phone: '+33600000101', domains: ['plomberie'], city: 'Marseille 5e', lat: 43.2925, lng: 5.3986, rating: 4.9, count: 128, urgent: true, quals: [] as string[] },
  { first: 'Sophie', last: 'Martin', company: 'Martin Élec', phone: '+33600000102', domains: ['electricite'], city: 'Marseille 8e', lat: 43.2629, lng: 5.3827, rating: 4.8, count: 86, urgent: true, quals: ['Qualifelec'] },
  { first: 'Julien', last: 'Roux', company: 'Roux Thermique', phone: '+33600000103', domains: ['energetique', 'plomberie'], city: 'Marseille 4e', lat: 43.3065, lng: 5.4007, rating: 4.7, count: 64, urgent: true, quals: ['RGE', 'Qualigaz'] },
  { first: 'Nadia', last: 'Haddad', company: 'Haddad Services', phone: '+33600000104', domains: ['plomberie', 'electricite'], city: 'Marseille 1er', lat: 43.2999, lng: 5.3811, rating: 4.6, count: 41, urgent: false, quals: [] },
  { first: 'Thomas', last: 'Garcia', company: 'Garcia Clim', phone: '+33600000105', domains: ['energetique'], city: 'Aix-en-Provence', lat: 43.5297, lng: 5.4474, rating: 4.9, count: 152, urgent: true, quals: ['RGE'] },
  { first: 'Lucas', last: 'Moreau', company: 'LM Électricité', phone: '+33600000106', domains: ['electricite'], city: 'Marseille 13e', lat: 43.3486, lng: 5.4339, rating: 4.5, count: 23, urgent: true, quals: [] },
];

/** Avis de démo (rotation) : de vrais avis rattachés à des interventions clôturées. */
const REVIEW_POOL: { rating: number; tags: string[]; comment: string }[] = [
  { rating: 5, tags: ['Ponctuel', 'Travail soigné'], comment: 'Arrivé en 25 minutes, fuite réparée proprement. Devis clair avant de commencer, rien à redire.' },
  { rating: 5, tags: ['Bon conseil', 'Prix respecté'], comment: 'Très pédagogue, il a pris le temps d’expliquer la panne. Prix conforme au devis.' },
  { rating: 4, tags: ['Ponctuel'], comment: 'Intervention efficace. Un peu de retard mais il a prévenu par message.' },
  { rating: 5, tags: ['Travail soigné', 'Sympathique'], comment: 'Chantier laissé propre, je recommande sans hésiter.' },
  { rating: 4, tags: ['Prix respecté'], comment: 'Bon travail, pièce remplacée le jour même.' },
];
const REVIEWERS = [
  { phone: '+33600000020', first: 'Léa', last: 'Fabre', line1: '8 boulevard Longchamp', postalCode: '13001', lat: 43.3035, lng: 5.3925 },
  { phone: '+33600000021', first: 'Marc', last: 'Olivier', line1: '45 rue de Rome', postalCode: '13006', lat: 43.2905, lng: 5.3796 },
  { phone: '+33600000022', first: 'Inès', last: 'Belkacem', line1: '3 avenue du Prado', postalCode: '13008', lat: 43.2752, lng: 5.3897 },
];
const DAY = 86_400_000;

/** Comptes rendus des interventions clôturées (« Voir le compte rendu » côté client), par prestation puis par métier. */
const REPORTS: Record<string, { notes: string; materials: string }> = {
  'fuite-eau': {
    notes: 'Fuite localisée sur le raccord du flexible d’alimentation sous l’évier (joint fibre écrasé). Raccord démonté, joint remplacé, serrage contrôlé. Mise en eau 15 min sans suintement.',
    materials: 'Joint fibre 15/21, flexible inox 40 cm, ruban PTFE',
  },
  'panne-courant': {
    notes: 'Disjonction due à un défaut d’isolement sur le circuit prises de la cuisine (bouchon de prise humide derrière le plan de travail). Prise remplacée, circuit testé à l’ohmmètre, différentiel 30 mA réarmé et testé.',
    materials: 'Prise 2P+T 16 A, boîte d’encastrement étanche, bornes de connexion',
  },
  'chaudiere-panne': {
    notes: 'Mise en sécurité répétée : électrode d’ionisation encrassée. Nettoyage de l’électrode et du brûleur, contrôle de la pression (1,4 bar) et de l’étanchéité gaz. Chaudière relancée, fonctionnement vérifié en chauffage et eau chaude.',
    materials: 'Électrode d’ionisation, joint de chambre de combustion',
  },
  plomberie: {
    notes: 'Diagnostic sur place, remplacement de la pièce défectueuse et contrôle d’étanchéité après remise en eau. Installation laissée propre.',
    materials: 'Joints, raccords laiton, ruban PTFE',
  },
  electricite: {
    notes: 'Contrôle du circuit concerné, remplacement de l’appareillage défectueux, test du différentiel et vérification des serrages au tableau.',
    materials: 'Appareillage 16 A, bornes de connexion',
  },
  energetique: {
    notes: 'Nettoyage et contrôle de l’appareil, vérification des pressions et des sécurités, essai de fonctionnement complet avec le client.',
    materials: 'Kit d’entretien, joints',
  },
};

/** Heure locale Europe/Paris dans `daysAhead` jours (jamais un dimanche, jour sans disponibilités). */
function parisAt(daysAhead: number, hh: number, mm = 0) {
  let day = new Date(Date.now() + daysAhead * DAY);
  if (new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', weekday: 'short' }).format(day) === 'Sun') day = new Date(day.getTime() + DAY);
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(day);
  const naive = new Date(`${date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`);
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', timeZoneName: 'shortOffset' }).formatToParts(naive).find((p) => p.type === 'timeZoneName')!.value;
  const hours = Number(/GMT([+-]\d+)/.exec(offset)?.[1] ?? 0);
  return new Date(naive.getTime() - hours * 3600_000);
}
const ref = (i: number, j: number) => `DEP-R${i}${j}${Math.random().toString(36).slice(2, 5).toUpperCase().padEnd(3, 'X')}`;

async function main() {
  const { db, close } = createDb(process.env.DATABASE_URL, { max: 1 });

  await db.execute(sql`TRUNCATE TABLE audit_logs, files, notifications, messages, conversations, invoices, webhook_events,
    payments, reviews, disputes, intervention_reports, quote_lines, quotes, dispatch_offers, booking_locations,
    booking_events, referral_credits, bookings, favorites, addresses, availability_exceptions, availability_rules, artisan_documents,
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
  const [clientAddr] = await db
    .insert(s.addresses)
    .values({ userId: client!.id, label: 'Domicile', line1: '12 rue Paradis', postalCode: '13001', city: 'Marseille', floor: '3e', doorCode: 'A1234', lat: 43.2951, lng: 5.3772, isDefault: true })
    .returning();

  // Clients de démo auteurs d'avis (Camille + 3 voisins), chacun avec son adresse.
  const authors: { userId: string; addressId: string }[] = [{ userId: client!.id, addressId: clientAddr!.id }];
  for (const r of REVIEWERS) {
    const [u] = await db.insert(s.users).values({ phone: r.phone, phoneVerifiedAt: new Date(), firstName: r.first, lastName: r.last, roles: ['client'] }).returning();
    const [addr] = await db
      .insert(s.addresses)
      .values({ userId: u!.id, label: 'Domicile', line1: r.line1, postalCode: r.postalCode, city: 'Marseille', lat: r.lat, lng: r.lng, isDefault: true })
      .returning();
    authors.push({ userId: u!.id, addressId: addr!.id });
  }
  let reviewCount = 0;
  const artisanIds = new Map<string, { userId: string; profileId: string }>();

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
    artisanIds.set(a.phone, { userId: u!.id, profileId: p!.id });
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
    // Interventions clôturées + avis réels (une par auteur). Les agrégats ratingAvg / ratingCount ci-dessus
    // représentent l'historique complet (ces avis en font partie) : la note évolue ensuite de façon incrémentale.
    const ai = ARTISANS.indexOf(a);
    for (const [j, author] of authors.entries()) {
      const sv = mine.find((x) => x.domain === a.domains[j % a.domains.length]) ?? mine[0]!;
      const review = REVIEW_POOL[(ai + j) % REVIEW_POOL.length]!;
      const closedAt = new Date(Date.now() - (4 + j * 9 + ai) * DAY);
      const scheduledAt = new Date(closedAt.getTime() - 2 * 3600_000);
      const total = sv.referencePriceCents + 2500;
      const [b] = await db
        .insert(s.bookings)
        .values({
          reference: ref(ai, j),
          kind: 'scheduled',
          status: 'closed',
          clientId: author.userId,
          artisanId: p!.id,
          domain: sv.domain,
          serviceId: sv.id,
          scheduledType: sv.kind === 'maintenance' ? 'maintenance' : 'repair',
          addressId: author.addressId,
          problemReason: sv.name.slice(0, 120),
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + sv.defaultDurationMinutes * 60_000),
          basePriceCents: sv.referencePriceCents,
          travelFeeCents: 2500,
          totalCents: total,
          authorizedCents: total,
          capturedCents: total,
          commissionRate: 0.15,
          commissionCents: Math.round(total * 0.15),
          acceptedAt: new Date(scheduledAt.getTime() - 3 * DAY),
          arrivedAt: scheduledAt,
          workDoneAt: new Date(closedAt.getTime() - 5 * 60_000),
          closedAt,
          createdAt: new Date(scheduledAt.getTime() - 3 * DAY),
        })
        .returning();
      await db.insert(s.conversations).values({ bookingId: b!.id, clientUserId: author.userId, artisanUserId: u!.id });
      const report = REPORTS[sv.slug] ?? REPORTS[sv.domain]!;
      await db.insert(s.interventionReports).values({
        bookingId: b!.id,
        feasible: true,
        notes: report.notes,
        materials: report.materials,
        createdAt: new Date(closedAt.getTime() - 10 * 60_000),
      });
      await db.insert(s.reviews).values({
        bookingId: b!.id,
        artisanId: p!.id,
        authorId: author.userId,
        rating: review.rating,
        tags: review.tags,
        comment: review.comment,
        createdAt: new Date(closedAt.getTime() + 3600_000),
        ...(j === 0 ? { replyBody: `Merci pour votre confiance ! ${a.first}`, replyAt: new Date(closedAt.getTime() + 5 * 3600_000) } : {}),
      });
      reviewCount++;
    }
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

  // Parrainage : Léa a saisi le code de Camille, 10 € pour chacune.
  const lea = authors[1]!.userId;
  await db.insert(s.clientProfiles).values({ userId: lea, referralCode: 'LEAFAB24', referredByUserId: client!.id });
  await db.insert(s.referralCredits).values([
    { userId: lea, otherUserId: client!.id, role: 'referee', amountCents: 1000 },
    { userId: client!.id, otherUserId: lea, role: 'referrer', amountCents: 1000 },
  ]);

  // Profil mis en avant (« Promouvoir mon compte », abonnement factice renouvelé automatiquement).
  const nadia = artisanIds.get('+33600000104')!;
  await db
    .update(s.artisanProfiles)
    .set({ proUntil: new Date(Date.now() + 20 * DAY), promotionAutoRenew: true, promotionSubscriptionRef: 'sub_fake_seed_nadia' })
    .where(sql`${s.artisanProfiles.id} = ${nadia.profileId}`);

  // Planning de Karim (+33600000101) avec Camille : une demande de RDV, une demande de prix, un RDV confirmé
  // annoté, et un événement personnel.
  const karim = artisanIds.get('+33600000101')!;
  const fuite = serviceRows.find((sv) => sv.slug === 'fuite-eau')!;
  const [karimFuite] = await db
    .select({ price: s.artisanServices.priceCents })
    .from(s.artisanServices)
    .where(sql`${s.artisanServices.artisanId} = ${karim.profileId} and ${s.artisanServices.serviceId} = ${fuite.id}`);
  const demo = async (v: { ref: string; status: 'requested' | 'accepted'; at: Date; minutes: number; base: number; priceOnRequest?: boolean; reason: string; description?: string; note?: string }) => {
    const total = v.base + 2500;
    const [b] = await db
      .insert(s.bookings)
      .values({
        reference: v.ref,
        kind: 'scheduled',
        status: v.status,
        clientId: client!.id,
        artisanId: karim.profileId,
        domain: 'plomberie',
        serviceId: v.priceOnRequest ? null : fuite.id,
        scheduledType: 'repair',
        addressId: clientAddr!.id,
        problemReason: v.reason,
        problemDescription: v.description ?? null,
        scheduledAt: v.at,
        endsAt: new Date(v.at.getTime() + v.minutes * 60_000),
        basePriceCents: v.base,
        travelFeeCents: 2500,
        totalCents: total,
        authorizedCents: v.priceOnRequest ? 0 : total,
        commissionRate: 0.15,
        priceOnRequest: !!v.priceOnRequest,
        artisanAcceptedAt: v.status === 'accepted' ? new Date(Date.now() - 2 * 3600_000) : null,
        acceptedAt: v.status === 'accepted' ? new Date(Date.now() - 2 * 3600_000) : null,
        artisanNote: v.note ?? null,
        createdAt: new Date(Date.now() - 3 * 3600_000),
      })
      .returning();
    await db.insert(s.bookingEvents).values([
      { bookingId: b!.id, fromStatus: null, toStatus: v.priceOnRequest ? 'requested' : 'pending_payment', actor: 'client', actorUserId: client!.id, createdAt: new Date(Date.now() - 3 * 3600_000) },
      ...(v.priceOnRequest ? [] : [{ bookingId: b!.id, fromStatus: 'pending_payment' as const, toStatus: 'requested' as const, actor: 'system' as const, actorUserId: client!.id, createdAt: new Date(Date.now() - 3 * 3600_000 + 60_000) }]),
      ...(v.status === 'accepted' ? [{ bookingId: b!.id, fromStatus: 'requested' as const, toStatus: 'accepted' as const, actor: 'artisan' as const, actorUserId: karim.userId, createdAt: new Date(Date.now() - 2 * 3600_000) }] : []),
    ]);
    if (!v.priceOnRequest) {
      await db.insert(s.payments).values({ bookingId: b!.id, provider: 'fake', providerRef: `pi_fake_seed_${v.ref}`, kind: 'authorization', status: 'authorized', amountCents: total, authorizedAt: new Date(), paymentMethodRef: 'pm_fake_visa' });
    }
    // Messagerie ouverte seulement après l'acceptation.
    if (v.status === 'accepted') await db.insert(s.conversations).values({ bookingId: b!.id, clientUserId: client!.id, artisanUserId: karim.userId });
  };
  await demo({ ref: 'DEP-DEMO01', status: 'requested', at: parisAt(2, 10), minutes: 60, base: karimFuite?.price ?? fuite.referencePriceCents, reason: 'Fuite sous l’évier' });
  await demo({ ref: 'DEP-DEMO02', status: 'requested', at: parisAt(3, 15), minutes: 60, base: 0, priceOnRequest: true, reason: 'Autre', description: "Installation d'un adoucisseur d'eau sous l'évier de la cuisine." });
  await demo({ ref: 'DEP-DEMO03', status: 'accepted', at: parisAt(4, 9), minutes: 60, base: karimFuite?.price ?? fuite.referencePriceCents, reason: 'Robinet qui goutte', note: 'Prévoir un mitigeur 15/21 et du téflon.' });
  // Tarifs de Karim : un motif personnel (hors catalogue) et une prestation du catalogue désactivée.
  const [mitigeur] = await db
    .insert(s.services)
    .values({
      domain: 'plomberie',
      slug: 'custom-seed-mitigeur-thermostatique',
      name: 'Remplacement de mitigeur thermostatique',
      kind: 'repair',
      urgentEligible: false,
      referencePriceCents: 14000,
      defaultDurationMinutes: 75,
      sortOrder: 1000,
      ownerArtisanId: karim.profileId,
    })
    .returning();
  await db.insert(s.artisanServices).values({ artisanId: karim.profileId, serviceId: mitigeur!.id, priceCents: 14000, durationMinutes: 75 });
  const chasse = serviceRows.find((sv) => sv.slug === 'chasse-eau')!;
  await db
    .update(s.artisanServices)
    .set({ active: false })
    .where(sql`${s.artisanServices.artisanId} = ${karim.profileId} and ${s.artisanServices.serviceId} = ${chasse.id}`);

  await db.insert(s.availabilityExceptions).values({
    artisanId: karim.profileId,
    startsAt: parisAt(1, 12, 30),
    endsAt: parisAt(1, 14),
    reason: 'Manger avec Grégoire',
    kind: 'personal',
    color: 'green',
  });

  console.log(`✔ seed : ${serviceRows.length} prestations, ${ARTISANS.length + 1} artisans, ${reviewCount} avis, client ${client!.phone}, admin ${admin!.phone}`);
  await close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
