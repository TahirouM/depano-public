import { NextResponse, type NextRequest } from 'next/server';

const REFRESH_COOKIE = 'depano_admin_rt';

/** Redirige vers /login toute page protégée consultée sans session. */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  // Démo en ligne : pas de connexion, on arrive directement sur le back-office.
  if (process.env.NEXT_PUBLIC_DEMO === '1') {
    if (!pathname.startsWith('/login')) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith('/login')) return NextResponse.next();
  if (!req.cookies.get(REFRESH_COOKIE)?.value) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|svg|ico)$).*)'],
};
