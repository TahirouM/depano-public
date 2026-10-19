import { NextResponse } from 'next/server';
import { API_URL, apiUnreachable } from '@/lib/server/session';

export async function POST(req: Request) {
  const body = await req.text();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/v1/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
      cache: 'no-store',
    });
  } catch {
    return apiUnreachable();
  }
  const text = await res.text();
  return new NextResponse(text || null, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}
