import { NextResponse } from 'next/server';
import type { ApiErrorBody, AuthResult } from '@depano/schemas';
import { API_URL, apiUnreachable, clearSessionCookies, setSessionCookies } from '@/lib/server/session';

const BACKOFFICE_ROLES = ['admin', 'support'] as const;

/**
 * Vérifie l'OTP auprès de l'API puis pose les jetons dans des cookies httpOnly.
 * Seuls les comptes admin ou support peuvent ouvrir une session back-office.
 */
export async function POST(req: Request) {
  const { phone, code } = (await req.json().catch(() => ({}))) as { phone?: string; code?: string };
  let res: Response;
  try {
    res = await fetch(`${API_URL}/v1/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ phone, code, deviceName: 'Back-office DEPANO' }),
      cache: 'no-store',
    });
  } catch {
    return apiUnreachable();
  }
  const json = (await res.json().catch(() => null)) as AuthResult | ApiErrorBody | null;
  if (!res.ok || !json || !('accessToken' in json)) {
    return NextResponse.json(json ?? { statusCode: res.status, code: 'error', message: 'Code invalide' }, { status: res.status });
  }

  const allowed = json.user.roles.some((r) => (BACKOFFICE_ROLES as readonly string[]).includes(r));
  if (!allowed) {
    // Révoque la session tout juste créée : ce compte n'a rien à faire ici.
    await fetch(`${API_URL}/v1/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${json.accessToken}` },
      body: JSON.stringify({ refreshToken: json.refreshToken }),
    }).catch(() => undefined);
    const out = NextResponse.json(
      { statusCode: 403, code: 'forbidden_role', message: 'Ce compte n’a pas accès au back-office (rôle admin ou support requis).' },
      { status: 403 },
    );
    clearSessionCookies(out);
    return out;
  }

  const out = NextResponse.json({ user: json.user });
  setSessionCookies(out, json);
  return out;
}
