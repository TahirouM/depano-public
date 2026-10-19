import type { AuthTokens } from '@depano/schemas';
import type { NextResponse } from 'next/server';

export const API_URL = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export const ACCESS_COOKIE = 'depano_admin_at';
export const REFRESH_COOKIE = 'depano_admin_rt';

/** Durée de vie du cookie de refresh (le serveur reste maître de la validité réelle). */
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

const base = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

export function setSessionCookies(res: NextResponse, tokens: AuthTokens) {
  res.cookies.set(ACCESS_COOKIE, tokens.accessToken, { ...base, maxAge: Math.max(60, tokens.expiresIn - 30) });
  res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, { ...base, maxAge: REFRESH_MAX_AGE });
}

export function clearSessionCookies(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, '', { ...base, maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, '', { ...base, maxAge: 0 });
}

/** Échange un refresh token contre une nouvelle paire de jetons (rotation côté API). */
export async function refreshTokens(refreshToken: string): Promise<AuthTokens | null> {
  try {
    const res = await fetch(`${API_URL}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as AuthTokens;
  } catch {
    return null;
  }
}

export function apiUnreachable() {
  return Response.json(
    { statusCode: 502, code: 'api_unreachable', message: "L'API DEPANO est injoignable. Réessayez dans un instant." },
    { status: 502 },
  );
}
