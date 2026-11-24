import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authTimeIsFresh } from '@/lib/auth/auth-age';
import { readSessionAccessToken, readSessionAuthTime } from '@/lib/auth/session-cookies';
import {
  contentSecurityPolicy,
  CSP_REPORT_PATH,
  cspHeaderName,
} from '@/lib/security/content-security-policy';

// The skylcn-ui playground (sandbox only) is a static export with its own inline scripts, which
// a nonce cannot reach; it keeps the headers next.config.ts sets for every path.
function isPlayground(pathname: string): boolean {
  return (
    pathname === '/playground' ||
    pathname.startsWith('/playground/') ||
    pathname.startsWith('/playground-assets/')
  );
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // A fresh nonce per request (Next's CSP guide): Next reads it from the request's policy header
  // and puts it on its scripts; the root layout hands it to the theme script and Tiptap.
  const csp = isPlayground(pathname)
    ? null
    : {
        header: cspHeaderName(),
        nonce: btoa(crypto.randomUUID()),
      };
  const policy = csp ? contentSecurityPolicy(csp.nonce) : null;

  function withPolicy(response: NextResponse): NextResponse {
    if (csp && policy) response.headers.set(csp.header, policy);
    return response;
  }

  function next(): NextResponse {
    if (!csp || !policy) return NextResponse.next();
    const headers = new Headers(request.headers);
    headers.set('x-nonce', csp.nonce);
    headers.set(csp.header, policy);
    return withPolicy(NextResponse.next({ request: { headers } }));
  }

  const token = readSessionAccessToken(request.cookies);

  const publicRoutes = ['/login', '/api/auth'];

  // The container health check (api/health/route.ts) asks without a session, and the browser
  // posts CSP reports with or without one
  if (
    pathname === '/api/health' ||
    pathname === CSP_REPORT_PATH ||
    publicRoutes.some((route) => pathname.startsWith(route))
  ) {
    return next();
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
    return withPolicy(NextResponse.redirect(new URL('/login', request.url)));
  }

  return next();
}

// map/: the point picker's glyphs, sprites and MapLibre worker (public/map), static like the icons
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|map/).*)'],
};
