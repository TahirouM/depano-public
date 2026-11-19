import type {
  AdminArtisanDetailDto,
  AdminArtisanRowDto,
  AdminBookingDetailDto,
  AdminDisputeRowDto,
  AdminMetricsDto,
  AdminUserRowDto,
  BookingSummaryDto,
  ZoneDto,
} from '@depano/schemas';
import recording from './fixtures.json';
import { shiftDates } from './time';

/**
 * Faux backend de la démo en ligne (NEXT_PUBLIC_DEMO=1) : rejoue dans le navigateur les réponses
 * enregistrées par scripts/record-demo.mjs. Les actions (validation, suspension, zones…) modifient
 * une copie en mémoire : elles restent visibles jusqu'au rechargement de la page.
 */
type Store = Record<string, unknown>;
type Service = { id: string; active: boolean } & Record<string, unknown>;

let store: Store | null = null;
const db = () => (store ??= shiftDates((recording as { store: Store }).store, (recording as { recordedAt: string }).recordedAt));

const json = (body: unknown, status = 200) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const notFound = () => json({ statusCode: 404, code: 'not_found', message: 'Élément introuvable.' }, 404);

/** Pagination par position, comme le curseur opaque de l'API. */
function page<T>(items: T[], params: URLSearchParams) {
  const start = Number(params.get('cursor') ?? 0);
  const limit = Number(params.get('limit') ?? 50);
  const next = start + limit < items.length ? String(start + limit) : null;
  return { items: items.slice(start, start + limit), nextCursor: next };
}

const matches = (q: string | null, ...fields: (string | null | undefined)[]) =>
  !q || fields.some((f) => f?.toLowerCase().includes(q.trim().toLowerCase()));

/** Période la plus proche parmi celles enregistrées (7, 30, 90, 365 jours). */
function metrics(params: URLSearchParams): AdminMetricsDto | undefined {
  const from = params.get('from');
  const to = params.get('to');
  const span = from && to ? (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000 : 30;
  const keys = Object.keys(db()).filter((k) => k.startsWith('/admin/metrics#'));
  const best = keys.sort((a, b) => Math.abs(Number(a.split('#')[1]) - span) - Math.abs(Number(b.split('#')[1]) - span))[0];
  return best ? (db()[best] as AdminMetricsDto) : undefined;
}

/** Litiges reconstruits à partir des interventions (l'enregistrement peut ne pas en contenir). */
function disputes(): AdminDisputeRowDto[] {
  const recorded = (db()['/admin/disputes'] as AdminDisputeRowDto[] | undefined) ?? [];
  const known = new Set(recorded.map((d) => d.bookingId));
  const derived = ((db()['/admin/bookings'] as BookingSummaryDto[]) ?? []).flatMap((row) => {
    const b = db()[`/admin/bookings/${row.id}`] as AdminBookingDetailDto | undefined;
    if (!b?.dispute || known.has(b.id)) return [];
    const createdAt = b.dispute.createdAt;
    return [
      {
        id: b.dispute.id,
        bookingId: b.id,
        bookingReference: b.reference,
        reason: b.dispute.reason,
        status: b.dispute.status,
        clientName: b.client?.firstName ?? 'Client',
        artisanName: b.artisan?.displayName ?? null,
        amountCents: b.totalCents,
        createdAt,
        dueAt: new Date(new Date(createdAt).getTime() + 72 * 3_600_000).toISOString(),
      } as AdminDisputeRowDto,
    ];
  });
  return [...recorded, ...derived];
}

function setArtisan(id: string, patch: Partial<AdminArtisanDetailDto>) {
  const key = `/admin/artisans/${id}`;
  const detail = db()[key] as AdminArtisanDetailDto | undefined;
  if (!detail) return notFound();
  const next = { ...detail, ...patch };
  db()[key] = next;
  const rows = db()['/admin/artisans'] as AdminArtisanRowDto[];
  db()['/admin/artisans'] = rows.map((r) => (r.id === id ? { ...r, status: next.status } : r));
  return json(next);
}

function setDocument(id: string, patch: Record<string, unknown>) {
  for (const key of Object.keys(db()).filter((k) => /^\/admin\/artisans\/[^/]+$/.test(k))) {
    const a = db()[key] as AdminArtisanDetailDto;
    const doc = a.documents.find((d) => d.id === id);
    if (!doc) continue;
    Object.assign(doc, patch);
    return json(doc);
  }
  return notFound();
}

async function write(method: string, path: string, body: Record<string, unknown>): Promise<Response> {
  const now = new Date().toISOString();
  let m: RegExpMatchArray | null;
  if ((m = path.match(/^\/admin\/artisans\/([^/]+)\/(approve|reject|suspend|reinstate)$/))) {
    const status = { approve: 'approved', reject: 'rejected', suspend: 'suspended', reinstate: 'approved' }[m[2]!] as AdminArtisanDetailDto['status'];
    return setArtisan(m[1]!, {
      status,
      rejectionReason: m[2] === 'reject' || m[2] === 'suspend' ? ((body.reason as string) ?? null) : null,
      ...(status === 'approved' ? { approvedAt: now } : {}),
    });
  }
  if ((m = path.match(/^\/admin\/documents\/([^/]+)\/(approve|reject)$/))) {
    return setDocument(m[1]!, m[2] === 'approve' ? { status: 'approved', rejectionReason: null } : { status: 'rejected', rejectionReason: body.reason ?? null });
  }
  if ((m = path.match(/^\/admin\/disputes\/([^/]+)\/resolve$/))) {
    const row = disputes().find((d) => d.id === m![1]);
    if (!row) return notFound();
    const recorded = (db()['/admin/disputes'] as AdminDisputeRowDto[]).filter((d) => d.id !== row.id);
    db()['/admin/disputes'] = [...recorded, { ...row, status: 'resolved' }];
    const b = db()[`/admin/bookings/${row.bookingId}`] as AdminBookingDetailDto;
    if (b.dispute) b.dispute = { ...b.dispute, status: 'resolved', resolution: body.resolution, resolutionNote: body.note, resolvedAt: now } as never;
    return json(b.dispute ?? {});
  }
  if (path === '/admin/services' && method === 'POST') {
    const created = { id: crypto.randomUUID(), description: null, active: true, ...body };
    db()['/admin/services'] = [...(db()['/admin/services'] as Service[]), created];
    return json(created, 201);
  }
  if ((m = path.match(/^\/admin\/services\/([^/]+)$/)) && method === 'PATCH') {
    const list = db()['/admin/services'] as Service[];
    const found = list.find((s) => s.id === m![1]);
    if (!found) return notFound();
    Object.assign(found, body);
    return json(found);
  }
  if (path === '/admin/zones' && method === 'POST') {
    const created = { id: crypto.randomUUID(), active: true, ...body } as ZoneDto;
    db()['/admin/zones'] = [...(db()['/admin/zones'] as ZoneDto[]), created];
    return json(created, 201);
  }
  if ((m = path.match(/^\/admin\/zones\/([^/]+)$/)) && method === 'PATCH') {
    const found = (db()['/admin/zones'] as ZoneDto[]).find((z) => z.id === m![1]);
    if (!found) return notFound();
    Object.assign(found, body);
    return json(found);
  }
  return json({ statusCode: 501, code: 'demo', message: 'Action indisponible dans la démo.' }, 501);
}

function read(path: string, params: URLSearchParams): Response {
  const q = params.get('q');
  if (path === '/admin/metrics') return json(metrics(params) ?? {});
  if (path === '/admin/artisans') {
    const status = params.get('status');
    const rows = (db()[path] as AdminArtisanRowDto[]).filter(
      (a) => (!status || a.status === status) && matches(q, a.displayName, a.companyName, a.siret, a.phone, a.city),
    );
    return json(page(rows, params));
  }
  if (path === '/admin/bookings') {
    const status = params.get('status');
    const kind = params.get('kind');
    const rows = (db()[path] as BookingSummaryDto[]).filter(
      (b) => (!status || b.status === status) && (!kind || b.kind === kind) && matches(q, b.reference, b.serviceName, b.city, b.counterpart?.name),
    );
    return json(page(rows, params));
  }
  if (path === '/admin/users') {
    const rows = (db()[path] as AdminUserRowDto[]).filter((u) => matches(q, u.firstName, u.lastName, u.phone, u.email));
    return json(page(rows, params));
  }
  if (path === '/admin/disputes') {
    const status = params.get('status');
    return json(disputes().filter((d) => !status || d.status === status));
  }
  if (path === '/admin/exports/dac7') {
    const rows = (db()['/admin/artisans'] as AdminArtisanRowDto[]).filter((a) => a.status === 'approved');
    const csv = ['nom;entreprise;siret;interventions', ...rows.map((a) => [a.displayName, a.companyName ?? '', a.siret ?? '', a.completedCount].join(';'))].join('\n');
    return json({ url: `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`, rows: rows.length });
  }
  if (path === '/auth/sessions') return json([]);
  const found = db()[path];
  return found === undefined ? notFound() : json(found);
}

export async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const path = url.pathname.replace(/^\/v1/, '');
  const method = (init?.method ?? 'GET').toUpperCase();
  await new Promise((r) => setTimeout(r, 150));
  if (method === 'GET') return read(path, url.searchParams);
  const body = typeof init?.body === 'string' && init.body ? (JSON.parse(init.body) as Record<string, unknown>) : {};
  return write(method, path, body);
}
