import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authTimeIsFresh } from '@/lib/auth/auth-age';
import { readSessionAccessToken, readSessionAuthTime } from '@/lib/auth/session-cookies';

export function proxy(request: NextRequest) {
  const token = readSessionAccessToken(request.cookies);

  const publicRoutes = ['/login', '/api/auth'];
  const pathname = request.nextUrl.pathname;

  // The container health check (api/health/route.ts) asks without a session
  if (pathname === '/api/health' || publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // `next dev` forwards /sandbox-api/* to the sandbox API (next.config.ts); core
  // checks the request's own token. Only there: the build inlines NODE_ENV as
  // production, so the image drops this branch and treats the path like any other.
  if (process.env.NODE_ENV === 'development' && pathname.startsWith('/sandbox-api/')) {
    return NextResponse.next();
  }

  // No session, or one whose sign-in is older than the panel accepts (auth-age.ts): /login sends
  // the admin on to Keycloak, which asks them to sign in again.
  if (!token || !authTimeIsFresh(readSessionAuthTime(request.cookies))) {
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const url = new URL('/login', request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
