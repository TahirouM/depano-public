import type {
  AvailabilityExceptionDto,
  BookingDetailDto,
  BookingStatus,
  BookingSummaryDto,
  ArtisanOwnServiceDto,
  ArtisanPrivateProfileDto,
  ConversationDto,
  DomainDto,
  Me,
  MessageDto,
  Paginated,
  PlanningDto,
} from '@depano/schemas';
import { useAppStore } from '@/stores/app';
import fixtures from './fixtures.json';
import { normalizeRecording } from './normalize';
import { shiftDates } from './time';

/**
 * Faux backend de la démo statique (EXPO_PUBLIC_DEMO=1, ex. Vercel) : rejoue les réponses de l'API
 * enregistrées par `scripts/record-demo.mjs` et simule les écritures en mémoire (perdues au
 * rechargement). Deux jeux : la cliente Camille et l'artisan Karim ; le rôle actif choisit le jeu.
 */
type Role = 'client' | 'artisan';
type Store = Record<string, unknown>;

const LATENCY_MS = 180;
const DEMO_TOKEN = 'demo';

const recorded = fixtures as unknown as { recordedAt: string; client: Store; artisan: Store };
// Les dates enregistrées sont décalées pour que « aujourd'hui » reste aujourd'hui.
const db: Record<Role, Store> = {
  client: normalizeRecording(shiftDates(recorded.client, recorded.recordedAt), recorded.client['/domains'] as DomainDto[]),
  artisan: normalizeRecording(shiftDates(recorded.artisan, recorded.recordedAt), recorded.client['/domains'] as DomainDto[]),
};
/** Espace affiché : suit le rôle actif de l'app (persisté, donc conservé au rechargement). */
let role: Role = 'client';

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
const notFound = () => new HttpError(404, 'not_found', 'Ressource introuvable.');

const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
const nowIso = () => new Date().toISOString();
const page = <T>(items: T[]): Paginated<T> => ({ items, nextCursor: null });

/* ------------------------------------------------------------------ */
/* Lecture                                                             */
/* ------------------------------------------------------------------ */

const other = (r: Role): Role => (r === 'client' ? 'artisan' : 'client');

/** Réponse enregistrée : clé exacte, sinon même chemin sans paramètres, dans le jeu actif puis l'autre. */
function lookup(path: string, prefer: Role = role): unknown {
  for (const r of [prefer, other(prefer)]) {
    const s = db[r];
    if (path in s) return s[path];
    const hit = Object.keys(s).find((k) => k.split('?')[0] === path);
    if (hit) return s[hit];
  }
  return undefined;
}

function me(): Me {
  const base = (db[role]['/me'] ?? db.client['/me']) as Me;
  const artisanMe = db.artisan['/me'] as Me;
  // En démo, le même compte ouvre les deux espaces.
  return { ...base, roles: ['client', 'artisan'], activeRole: role, artisan: artisanMe.artisan };
}

function bookingLists(as: Role, scope: string): BookingSummaryDto[] {
  const p = db[as][`/bookings?as=${as}&limit=100&scope=${scope}`] as Paginated<BookingSummaryDto> | undefined;
  return p?.items ?? [];
}

function bookingDetail(id: string): { r: Role; b: BookingDetailDto } | null {
  for (const r of [role, other(role)]) {
    const b = db[r][`/bookings/${id}`] as BookingDetailDto | undefined;
    if (b) return { r, b };
  }
  return null;
}

function planning(from: string, to: string): PlanningDto {
  const windows = Object.entries(db.artisan)
    .filter(([k]) => k.startsWith('/artisan/planning'))
    .map(([, v]) => v as PlanningDto);
  const f = new Date(from).getTime();
  const t = new Date(to).getTime();
  const inRange = (start: string | null, end?: string | null) => {
    if (!start) return false;
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : s;
    return e >= f && s <= t;
  };
  const seen = new Set<string>();
  const bookings = windows
    .flatMap((w) => w.bookings)
    .filter((b) => !seen.has(b.id) && seen.add(b.id) && inRange(b.scheduledAt ?? b.createdAt, b.endsAt));
  const exceptions = exceptionsList().filter((e) => inRange(e.startsAt, e.endsAt));
  return { bookings, exceptions, rules: windows[0]?.rules ?? [] };
}

const exceptionsList = () => (db.artisan['/artisan/availability/exceptions'] as AvailabilityExceptionDto[] | undefined) ?? [];

function searchArtisans(q: URLSearchParams) {
  const all = (lookup('/artisans', 'client') as Paginated<Record<string, unknown>> | undefined)?.items ?? [];
  const domain = q.get('domain');
  const text = q.get('q')?.toLowerCase().trim();
  const minRating = Number(q.get('minRating') ?? 0);
  const maxPrice = q.get('maxPriceCents') ? Number(q.get('maxPriceCents')) : null;
  const availableToday = q.get('availableToday') === 'true';
  let items = all.filter((a) => {
    const domains = a.domains as string[];
    if (domain && !domains.includes(domain)) return false;
    if (text && !`${a.displayName} ${a.companyName} ${domains.join(' ')}`.toLowerCase().includes(text)) return false;
    if (minRating && ((a.ratingAvg as number | null) ?? 0) < minRating) return false;
    if (maxPrice != null && a.fromPriceCents != null && (a.fromPriceCents as number) > maxPrice) return false;
    if (availableToday && !a.urgentAvailable && !a.nextSlotAt) return false;
    return true;
  });
  const sort = q.get('sort');
  const num = (v: unknown, d: number) => (typeof v === 'number' ? v : d);
  if (sort === 'distance') items = [...items].sort((a, b) => num(a.distanceKm, 1e9) - num(b.distanceKm, 1e9));
  if (sort === 'rating') items = [...items].sort((a, b) => num(b.ratingAvg, 0) - num(a.ratingAvg, 0));
  if (sort === 'price') items = [...items].sort((a, b) => num(a.fromPriceCents, 1e9) - num(b.fromPriceCents, 1e9));
  return page(items.slice(0, Number(q.get('limit') ?? 20)));
}

function slots(id: string, q: URLSearchParams) {
  const serviceId = q.get('serviceId');
  const exact = db.client[`/artisans/${id}/slots?days=14${serviceId ? `&serviceId=${serviceId}` : ''}`];
  return exact ?? db.client[`/artisans/${id}/slots?days=14`] ?? [];
}

function get(path: string, q: URLSearchParams): unknown {
  if (path === '/me') return me();
  if (path === '/artisans') return searchArtisans(q);
  let m = path.match(/^\/artisans\/([^/]+)\/slots$/);
  if (m) return slots(m[1]!, q);
  if (path === '/bookings') {
    const as = (q.get('as') ?? 'client') as Role;
    let items = bookingLists(as, q.get('scope') ?? 'all');
    const from = q.get('from');
    const to = q.get('to');
    if (from || to) {
      items = items.filter((b) => {
        const at = new Date(b.scheduledAt ?? b.createdAt).getTime();
        return (!from || at >= new Date(from).getTime()) && (!to || at <= new Date(to).getTime());
      });
    }
    return page(items);
  }
  m = path.match(/^\/bookings\/([^/]+)$/);
  if (m) {
    const hit = bookingDetail(m[1]!);
    if (!hit) throw notFound();
    return hit.b;
  }
  if (path === '/artisan/planning') return planning(q.get('from') ?? nowIso(), q.get('to') ?? nowIso());
  if (path === '/artisan/availability/exceptions') return exceptionsList();
  if (path === '/geo/address-search') return addressSuggestions(q.get('q') ?? '');
  if (path === '/geo/reverse') return addressSuggestions('Marseille')[0] ?? null;
  m = path.match(/^\/files\/([^/]+)\/url$/);
  if (m) return { url: '', expiresAt: nowIso() };
  const v = lookup(path);
  if (v === undefined) {
    // Listes paginées absentes de l'enregistrement : vides plutôt qu'en erreur.
    if (/\/(reviews|notifications|messages)$/.test(path)) return page([]);
    throw notFound();
  }
  return v;
}

function addressSuggestions(text: string) {
  const label = text.trim() || 'Marseille';
  return [
    { label: `12 rue Paradis, 13001 Marseille`, line1: '12 rue Paradis', postalCode: '13001', city: 'Marseille', lat: 43.2951, lng: 5.3783 },
    { label: `${label} — 45 boulevard Longchamp, 13001 Marseille`, line1: '45 boulevard Longchamp', postalCode: '13001', city: 'Marseille', lat: 43.3046, lng: 5.3941 },
  ];
}

/* ------------------------------------------------------------------ */
/* Écritures (simulées en mémoire)                                     */
/* ------------------------------------------------------------------ */

/** Change le statut d'une intervention dans le détail et dans toutes les listes. */
function setStatus(id: string, status: BookingStatus, extra: Partial<BookingDetailDto> = {}): BookingDetailDto {
  const hit = bookingDetail(id);
  if (!hit) throw notFound();
  const next = { ...hit.b, ...extra, status } as BookingDetailDto;
  for (const r of ['client', 'artisan'] as Role[]) {
    if (db[r][`/bookings/${id}`]) db[r][`/bookings/${id}`] = { ...(db[r][`/bookings/${id}`] as object), ...extra, status };
    for (const [k, v] of Object.entries(db[r])) {
      if (!k.startsWith('/bookings?') && !k.startsWith('/artisan/planning')) continue;
      const list = (v as Paginated<BookingSummaryDto>).items ?? (v as PlanningDto).bookings;
      for (const b of list ?? []) if (b.id === id) Object.assign(b, extra, { status });
    }
  }
  return next;
}

/** Statut atteint après une action (même enchaînement que la machine à états de l'API). */
const ACTION_TARGET: Record<string, BookingStatus> = {
  complete: 'closed',
  report: 'awaiting_code',
  quote: 'quote_pending',
  dispute: 'disputed',
};

const fakePayment = (amountCents: number) => ({
  provider: 'fake' as const,
  paymentIntentId: `pi_demo_${uuid()}`,
  setupIntentId: null,
  clientSecret: 'demo',
  customerId: null,
  ephemeralKey: null,
  amountCents,
});

function write(method: string, path: string, body: Record<string, unknown>): unknown {
  // Authentification : n'importe quel code est accepté.
  if (path === '/auth/otp/request') return { sent: true, retryAfterSeconds: 30, devCode: '000000' };
  if (path === '/auth/otp/verify' || path === '/auth/apple' || path === '/auth/google' || path === '/auth/passkeys/login/verify') {
    return { accessToken: DEMO_TOKEN, refreshToken: DEMO_TOKEN, expiresIn: 86_400, user: me(), isNewUser: false };
  }
  if (path === '/auth/refresh') return { accessToken: DEMO_TOKEN, refreshToken: DEMO_TOKEN, expiresIn: 86_400 };
  if (path === '/me/active-role') {
    role = body.role === 'artisan' ? 'artisan' : 'client';
    return me();
  }
  if (path === '/me' && method === 'PATCH') {
    db[role]['/me'] = { ...(db[role]['/me'] as object), ...body };
    return me();
  }

  let m = path.match(/^\/me\/favorites\/([^/]+)$/);
  if (m) {
    const favs = (db.client['/me/favorites'] as { id: string }[] | undefined) ?? [];
    const card = ((lookup('/artisans', 'client') as Paginated<{ id: string }> | undefined)?.items ?? []).find((a) => a.id === m![1]);
    db.client['/me/favorites'] = method === 'DELETE' ? favs.filter((f) => f.id !== m![1]) : card && !favs.some((f) => f.id === card.id) ? [...favs, card] : favs;
    return undefined;
  }

  if (path === '/bookings' && method === 'POST') {
    // Nouvelle demande : on montre la demande déjà en attente de l'artisan (ou la première active).
    const items = bookingLists('client', 'active');
    const pick = items.find((b) => b.status === 'requested') ?? items[0];
    if (!pick) throw new HttpError(409, 'demo', 'Indisponible dans la démo.');
    return { booking: bookingDetail(pick.id)!.b, payment: null };
  }
  m = path.match(/^\/bookings\/([^/]+)\/([\w/-]+)$/);
  if (m) {
    const [, id, action] = m as unknown as [string, string, string];
    switch (action) {
      case 'cancel':
        return setStatus(id, role === 'artisan' ? 'cancelled_by_artisan' : 'cancelled_by_client');
      case 'transition':
        return setStatus(id, body.to as BookingStatus);
      case 'respond':
        return setStatus(id, !body.accept ? 'cancelled_by_artisan' : body.priceCents ? 'pending_payment' : 'accepted', {
          artisanAccepted: !!body.accept,
        } as Partial<BookingDetailDto>);
      case 'artisan-note':
        return setStatus(id, bookingDetail(id)!.b.status, { artisanNote: (body.note as string | null) ?? null } as Partial<BookingDetailDto>);
      case 'confirm-payment':
        return setStatus(id, 'accepted');
      case 'quote/answer':
        return { booking: setStatus(id, body.accept === false ? 'cancelled_by_client' : 'in_progress'), payment: null };
      case 'payment-session':
        return fakePayment(bookingDetail(id)!.b.totalCents);
      case 'call':
        return { phoneNumber: '+33 1 00 00 00 00', expiresAt: new Date(Date.now() + 600_000).toISOString() };
      case 'location':
        return undefined;
      case 'review':
        return { id: uuid(), bookingId: id, rating: body.rating, tags: body.tags ?? [], comment: body.comment ?? null, photoUrls: [], authorFirstName: 'Camille', createdAt: nowIso(), reply: null };
      default:
        if (ACTION_TARGET[action]) return setStatus(id, ACTION_TARGET[action]!);
        return bookingDetail(id)?.b;
    }
  }

  if (path === '/artisan/availability/exceptions' && method === 'POST') {
    const e = { id: uuid(), reason: null, kind: 'unavailable', color: null, ...body } as AvailabilityExceptionDto;
    db.artisan['/artisan/availability/exceptions'] = [...exceptionsList(), e];
    return e;
  }
  m = path.match(/^\/artisan\/availability\/exceptions\/([^/]+)$/);
  if (m && method === 'DELETE') {
    db.artisan['/artisan/availability/exceptions'] = exceptionsList().filter((e) => e.id !== m![1]);
    return undefined;
  }
  if (path === '/artisan/services' && method === 'PUT') {
    const rows = body.services as { serviceId: string; priceCents: number; durationMinutes: number; active?: boolean }[];
    const own = ownServices();
    const next: ArtisanOwnServiceDto[] = rows.map((r) => {
      const prev = own.find((s) => s.serviceId === r.serviceId) ?? catalogService(r.serviceId);
      return { ...(prev as ArtisanOwnServiceDto), priceCents: r.priceCents, durationMinutes: r.durationMinutes, active: r.active ?? true };
    });
    // Les motifs personnels ne disparaissent que par leur suppression explicite.
    for (const s of own) if (s.custom && !next.some((n) => n.serviceId === s.serviceId)) next.push(s);
    return saveOwnServices(next);
  }
  if (path === '/artisan/services/custom' && method === 'POST') {
    const s: ArtisanOwnServiceDto = {
      serviceId: uuid(),
      name: String(body.name),
      domain: body.domain as ArtisanOwnServiceDto['domain'],
      kind: (body.kind as ArtisanOwnServiceDto['kind']) ?? 'both',
      priceCents: Number(body.priceCents),
      durationMinutes: Number(body.durationMinutes ?? 60),
      custom: true,
      active: true,
    };
    return saveOwnServices([...ownServices(), s]);
  }
  m = path.match(/^\/artisan\/services\/custom\/([^/]+)$/);
  if (m && method === 'DELETE') {
    if (!ownServices().some((s) => s.serviceId === m![1] && s.custom)) throw notFound();
    return saveOwnServices(ownServices().filter((s) => s.serviceId !== m![1]));
  }
  if (path.startsWith('/artisan/')) {
    const profile = db.artisan['/artisan/profile'] as Record<string, unknown>;
    if (method === 'PATCH' || method === 'PUT') {
      db.artisan['/artisan/profile'] = { ...profile, ...body };
      return db.artisan['/artisan/profile'];
    }
    if (path === '/artisan/promotion/subscribe') return { promotion: { ...(db.artisan['/artisan/promotion'] as object), active: true }, payment: null };
    return lookup(path) ?? profile;
  }

  m = path.match(/^\/conversations\/([^/]+)\/messages$/);
  if (m) {
    const msg: MessageDto = {
      id: uuid(),
      conversationId: m[1]!,
      senderId: me().id,
      kind: (body.kind as MessageDto['kind']) ?? 'text',
      body: (body.body as string) ?? null,
      fileUrl: null,
      clientId: (body.clientId as string) ?? null,
      createdAt: nowIso(),
      readAt: null,
    };
    const key = `/conversations/${m[1]}/messages`;
    const store = db[role][key] ? db[role] : db[other(role)];
    const p = (store[key] as Paginated<MessageDto> | undefined) ?? page<MessageDto>([]);
    store[key] = { ...p, items: [msg, ...p.items] };
    const convs = db[role]['/conversations'] as ConversationDto[] | undefined;
    for (const c of convs ?? []) if (c.id === m[1]) Object.assign(c, { lastMessage: msg });
    return msg;
  }

  if (path === '/me/referral/apply') return { amountCents: 1000, referral: db.client['/me/referral'] };
  if (path === '/files/upload-url') return { fileId: uuid(), uploadUrl: '', method: 'PUT', headers: {}, expiresAt: nowIso() };
  m = path.match(/^\/files\/([^/]+)\/complete$/);
  if (m) return { id: m[1], url: '' };
  if (method === 'DELETE' || /\/(read|read-all|logout|push-tokens)$/.test(path)) return undefined;
  // Par défaut : l'écriture « réussit » et renvoie l'état courant de la ressource.
  return lookup(path) ?? {};
}

/* ------------------------------------------------------------------ */
/* Prestations de l'artisan (Karim)                                    */
/* ------------------------------------------------------------------ */

const ownServices = () => ((db.artisan['/artisan/profile'] as ArtisanPrivateProfileDto).services ?? []) as ArtisanOwnServiceDto[];

function catalogService(serviceId: string): Omit<ArtisanOwnServiceDto, 'priceCents' | 'durationMinutes' | 'active'> | undefined {
  for (const d of (db.client['/domains'] as DomainDto[] | undefined) ?? []) {
    const s = d.services.find((x) => x.id === serviceId);
    if (s) return { serviceId: s.id, name: s.name, domain: s.domain, kind: s.kind, custom: false };
  }
  return undefined;
}

/** Enregistre les prestations et répercute les actives sur la fiche publique vue par les clients. */
function saveOwnServices(services: ArtisanOwnServiceDto[]): ArtisanPrivateProfileDto {
  const profile = { ...(db.artisan['/artisan/profile'] as ArtisanPrivateProfileDto), services };
  db.artisan['/artisan/profile'] = profile;
  const publicKey = `/artisans/${profile.id}`;
  const pub = db.client[publicKey] as { services: unknown[] } | undefined;
  if (pub) pub.services = services.filter((s) => s.active).map(({ active: _active, ...s }) => s);
  return profile;
}

/* ------------------------------------------------------------------ */
/* fetch                                                               */
/* ------------------------------------------------------------------ */

const json = (status: number, data: unknown) =>
  new Response(data === undefined ? null : JSON.stringify(data), { status: data === undefined ? 204 : status, headers: { 'Content-Type': 'application/json' } });

/** `fetch` de remplacement passé au client API typé (même contrat que l'API /v1). */
export const demoFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const method = (init?.method ?? 'GET').toUpperCase();
  const path = url.pathname.replace(/^\/v1/, '');
  await new Promise((r) => setTimeout(r, LATENCY_MS));
  role = useAppStore.getState().activeRole;
  try {
    if (method === 'GET') return json(200, structuredClone(get(path, url.searchParams)));
    const body = typeof init?.body === 'string' && init.body ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    return json(200, structuredClone(write(method, path, body)));
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { statusCode: e.status, code: e.code, message: e.message });
    console.warn('[démo]', method, path, e);
    return json(500, { statusCode: 500, code: 'demo_error', message: 'Indisponible dans la démo.' });
  }
};

/** Session factice : la démo s'ouvre déjà connectée. */
export const DEMO_SESSION = { accessToken: DEMO_TOKEN, refreshToken: DEMO_TOKEN, userId: (db.client['/me'] as Me).id };
