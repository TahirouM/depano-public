import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import type { AuthTokens } from '@depano/schemas';
import {
  ACCESS_COOKIE,
  API_URL,
  REFRESH_COOKIE,
  apiUnreachable,
  clearSessionCookies,
  refreshTokens,
  setSessionCookies,
} from '@/lib/server/session';

/**
 * Proxy authentifié vers l'API : le navigateur n'a jamais accès aux jetons.
 * Le jeton d'accès (cookie httpOnly) est ajouté en en-tête Authorization ;
 * sur 401, on tente une rotation via le refresh token puis on rejoue la requête.
 * Seules les routes utiles au back-office sont relayées.
 */
const ALLOWED_PREFIXES = ['admin/', 'me', 'files/', 'domains', 'auth/sessions'];

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  const joined = path.map(encodeURIComponent).join('/');
  if (!ALLOWED_PREFIXES.some((p) => joined === p.replace(/\/$/, '') || joined.startsWith(p))) {
    return NextResponse.json({ statusCode: 404, code: 'not_found', message: 'Route inconnue' }, { status: 404 });
  }
  const target = `${API_URL}/v1/${joined}${req.nextUrl.search}`;
  const jar = await cookies();
  let accessToken = jar.get(ACCESS_COOKIE)?.value;
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer();

  let rotated: AuthTokens | null = null;
  if (!accessToken && refreshToken) {
    rotated = await refreshTokens(refreshToken);
    accessToken = rotated?.accessToken;
  }

  const send = (token?: string) =>
    fetch(target, {
      method: req.method,
      headers: {
        Accept: 'application/json',
        ...(req.headers.get('content-type') ? { 'Content-Type': req.headers.get('content-type')! } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body && body.byteLength > 0 ? body : undefined,
      cache: 'no-store',
    });

  let res: Response;
  try {
    res = await send(accessToken);
    if (res.status === 401 && refreshToken && !rotated) {
      rotated = await refreshTokens(refreshToken);
      if (rotated) res = await send(rotated.accessToken);
    }
  } catch {
    return apiUnreachable();
  }

  const payload = res.status === 204 ? null : await res.arrayBuffer();
  const out = new NextResponse(payload, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json', 'Cache-Control': 'no-store' },
  });
  if (res.status === 401) clearSessionCookies(out);
  else if (rotated) setSessionCookies(out, rotated);
  return out;
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
