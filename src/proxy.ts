import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { readSessionAccessToken } from '@/lib/auth/session-cookies';

export function proxy(request: NextRequest) {
  const token = readSessionAccessToken(request.cookies);

  const publicRoutes = ['/login', '/api/auth'];
  const pathname = request.nextUrl.pathname;

  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // `next dev` forwards /sandbox-api/* to the sandbox API (next.config.ts); core
  // checks the request's own token. Production has no such path.
  if (pathname.startsWith('/sandbox-api/')) {
    return NextResponse.next();
  }

  if (!token) {
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
