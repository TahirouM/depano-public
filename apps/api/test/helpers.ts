import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { sql } from '@depano/db';
import * as s from '@depano/db';
import type { Database } from '@depano/db';
import { AppModule } from '../src/app.module';
import { JobsService, type EnqueueOptions, type QueueName } from '../src/infra/jobs';
import { RealtimeService, type EventName } from '../src/infra/realtime';
import { DbConnection } from '../src/infra/db';
import { RedisConnection } from '../src/infra/redis';
import { createProcessors, type Processor } from '../src/worker/processors';
import { ApiExceptionFilter } from '../src/common/error.filter';

export interface RecordedJob {
  queue: QueueName;
  name: string;
  data: any;
  opts: EnqueueOptions;
}

/** File mémoire : les jobs sont enregistrés puis exécutés à la demande, de façon synchrone. */
export class InMemoryJobs extends JobsService {
  jobs: RecordedJob[] = [];
  processors: Record<QueueName, Processor> | null = null;

  async add(queue: QueueName, name: string, data: unknown, opts: EnqueueOptions = {}) {
    if (opts.jobId && this.jobs.some((j) => j.opts.jobId === opts.jobId)) return;
    this.jobs.push({ queue, name, data, opts });
  }
  async remove(_queue: QueueName, jobId: string) {
    this.jobs = this.jobs.filter((j) => j.opts.jobId !== jobId);
  }
  find(queue: QueueName, name?: string) {
    return this.jobs.filter((j) => j.queue === queue && (!name || j.name === name));
  }
  /** Retire et exécute le premier job correspondant. */
  async run(queue: QueueName, name: string, match?: (d: any) => boolean) {
    const idx = this.jobs.findIndex((j) => j.queue === queue && j.name === name && (!match || match(j.data)));
    if (idx < 0) throw new Error(`Aucun job ${queue}/${name}`);
    const [job] = this.jobs.splice(idx, 1);
    return this.processors![queue]({ name: job!.name, data: job!.data as never });
  }
  clear(queue?: QueueName) {
    this.jobs = queue ? this.jobs.filter((j) => j.queue !== queue) : [];
  }
}

export class RecordingRealtime extends RealtimeService {
  events: { rooms: string[]; event: EventName; payload: any }[] = [];
  emitToRooms(rooms: string[], event: EventName, payload: unknown) {
    this.events.push({ rooms, event, payload });
  }
  of(event: EventName, room?: string) {
    return this.events.filter((e) => e.event === event && (!room || e.rooms.includes(room)));
  }
}

export interface TestContext {
  app: NestFastifyApplication;
  db: Database;
  jobs: InMemoryJobs;
  realtime: RecordingRealtime;
  close: () => Promise<void>;
}

export async function createTestApp(): Promise<TestContext> {
  const jobs = new InMemoryJobs();
  const realtime = new RecordingRealtime();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(JobsService)
    .useValue(jobs)
    .overrideProvider(RealtimeService)
    .useValue(realtime)
    .compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { rawBody: true, logger: ['error'] });
  app.setGlobalPrefix('v1');
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  jobs.processors = createProcessors(app);
  const db = app.get(DbConnection).db;
  return { app, db, jobs, realtime, close: () => app.close() };
}

const TABLES = `audit_logs, files, notifications, messages, conversations, invoices, webhook_events,
  payments, reviews, disputes, intervention_reports, quote_lines, quotes, dispatch_offers, booking_locations,
  booking_events, bookings, favorites, addresses, availability_exceptions, availability_rules, artisan_documents,
  artisan_services, artisan_profiles, services, domains, zones, consents, push_tokens, passkeys, sessions,
  otp_codes, client_profiles, users`;

export async function resetState(ctx: TestContext) {
  await ctx.db.execute(sql.raw(`TRUNCATE TABLE ${TABLES} CASCADE`));
  await ctx.app.get(RedisConnection).redis.flushdb();
  ctx.jobs.clear();
  ctx.realtime.events = [];
  tokenCache.clear();
}

export const PHONES = {
  admin: '+33600000001',
  support: '+33600000002',
  clientA: '+33600000010',
  clientB: '+33600000011',
  artisan1: '+33600000101',
  artisan2: '+33600000102',
  artisan3: '+33600000103',
  pending: '+33600000199',
};

/** Client à Marseille 1er ; artisans à moins de 5 km. */
export const CLIENT_POINT = { lat: 43.2951, lng: 5.3772 };

export interface Fixtures {
  services: { fuite: string; debouchage: string; robinet: string };
  users: Record<keyof typeof PHONES, string>;
  artisans: { a1: string; a2: string; a3: string; pending: string };
  addressA: string;
}

export async function seedFixtures(db: Database, opts: { urgent?: boolean } = {}): Promise<Fixtures> {
  await db.insert(s.zones).values({ name: 'Marseille', centerLat: 43.3, centerLng: 5.4, radiusKm: 35, commissionRate: 0.15 });
  await db.insert(s.domains).values([
    { code: 'plomberie', name: 'Plomberie', icon: 'droplet', sortOrder: 1 },
    { code: 'electricite', name: 'Électricité', icon: 'zap', sortOrder: 2 },
    { code: 'energetique', name: 'Énergétique', icon: 'flame', sortOrder: 3 },
  ]);
  const svc = await db
    .insert(s.services)
    .values([
      { domain: 'plomberie', slug: 'fuite-eau', name: 'Réparation de fuite', kind: 'repair', referencePriceCents: 9000, defaultDurationMinutes: 60, urgentEligible: true },
      { domain: 'plomberie', slug: 'debouchage', name: 'Débouchage', kind: 'repair', referencePriceCents: 8500, defaultDurationMinutes: 60, urgentEligible: true },
      { domain: 'plomberie', slug: 'robinetterie', name: 'Remplacement robinet', kind: 'repair', referencePriceCents: 7500, defaultDurationMinutes: 60, urgentEligible: false },
    ])
    .returning();
  const user = async (phone: string, roles: ('client' | 'artisan' | 'support' | 'admin')[], firstName: string) => {
    const [u] = await db.insert(s.users).values({ phone, phoneVerifiedAt: new Date(), firstName, lastName: 'Test', roles }).returning();
    return u!.id;
  };
  const users = {
    admin: await user(PHONES.admin, ['admin', 'support'], 'Admin'),
    support: await user(PHONES.support, ['support'], 'Support'),
    clientA: await user(PHONES.clientA, ['client'], 'Camille'),
    clientB: await user(PHONES.clientB, ['client'], 'Bob'),
    artisan1: await user(PHONES.artisan1, ['client', 'artisan'], 'Karim'),
    artisan2: await user(PHONES.artisan2, ['client', 'artisan'], 'Sophie'),
    artisan3: await user(PHONES.artisan3, ['client', 'artisan'], 'Julien'),
    pending: await user(PHONES.pending, ['client', 'artisan'], 'Mehdi'),
  };
  const urgent = opts.urgent ?? true;
  const artisan = async (userId: string, n: number, lat: number, lng: number, status: 'approved' | 'pending_review' = 'approved') => {
    const [p] = await db
      .insert(s.artisanProfiles)
      .values({
        userId,
        status,
        siret: `8000000000000${n}`,
        companyName: `Artisan ${n}`,
        companyActive: true,
        displayName: `Artisan ${n}`,
        domains: ['plomberie'],
        baseLat: lat,
        baseLng: lng,
        baseCity: 'Marseille',
        radiusKm: 20,
        travelFeeCents: 2500,
        urgentAvailable: urgent && status === 'approved',
        currentLat: lat,
        currentLng: lng,
        ratingAvg: 4.5,
        ratingCount: 10,
        stripeAccountId: `acct_fake_${n}`,
        payoutsEnabled: true,
      })
      .returning();
    await db.insert(s.artisanServices).values(svc.map((x) => ({ artisanId: p!.id, serviceId: x.id, priceCents: x.referencePriceCents, durationMinutes: 60 })));
    await db.insert(s.availabilityRules).values([0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ artisanId: p!.id, weekday, startTime: '08:00', endTime: '20:00' })));
    return p!.id;
  };
  const artisans = {
    a1: await artisan(users.artisan1, 1, 43.2961, 5.3802),
    a2: await artisan(users.artisan2, 2, 43.2985, 5.3751),
    a3: await artisan(users.artisan3, 3, 43.29, 5.37),
    pending: await artisan(users.pending, 4, 43.29, 5.38, 'pending_review'),
  };
  const [addr] = await db
    .insert(s.addresses)
    .values({ userId: users.clientA, label: 'Domicile', line1: '12 rue Paradis', postalCode: '13001', city: 'Marseille', floor: '3e', doorCode: 'A1234', ...CLIENT_POINT, isDefault: true })
    .returning();
  return {
    services: { fuite: svc[0]!.id, debouchage: svc[1]!.id, robinet: svc[2]!.id },
    users,
    artisans,
    addressA: addr!.id,
  };
}

export interface Res<T = any> {
  status: number;
  body: T;
}

export async function call<T = any>(ctx: TestContext, method: string, url: string, opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<Res<T>> {
  const r = await ctx.app.inject({
    method: method as 'GET',
    url: `/v1${url}`,
    headers: { ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}), ...opts.headers },
    payload: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  return { status: r.statusCode, body: r.body ? JSON.parse(r.body) : undefined };
}

const tokenCache = new Map<string, { accessToken: string; refreshToken: string; user: any; isNewUser: boolean }>();

/** Connexion OTP (code renvoyé hors production). */
export async function login(ctx: TestContext, phone: string) {
  const cached = tokenCache.get(phone);
  if (cached) return cached;
  const r1 = await call(ctx, 'POST', '/auth/otp/request', { body: { phone } });
  if (r1.status !== 200) throw new Error(`OTP request ${r1.status} ${JSON.stringify(r1.body)}`);
  const r2 = await call(ctx, 'POST', '/auth/otp/verify', { body: { phone, code: r1.body.devCode } });
  if (r2.status !== 200) throw new Error(`OTP verify ${r2.status} ${JSON.stringify(r2.body)}`);
  tokenCache.set(phone, r2.body);
  return r2.body as { accessToken: string; refreshToken: string; user: any; isNewUser: boolean };
}

export async function tokenOf(ctx: TestContext, phone: string) {
  return (await login(ctx, phone)).accessToken;
}
