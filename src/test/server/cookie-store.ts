import { NextRequest, NextResponse } from 'next/server';

/** What a browser learns about one cookie from a response's Set-Cookie line. */
export type SentCookie = {
  value: string;
  path?: string;
  domain?: string;
  maxAge?: number;
  secure: boolean;
  httpOnly: boolean;
  sameSite?: string;
};

function parseSetCookie(line: string): [string, SentCookie] {
  const [pair, ...attributes] = line.split('; ');
  const splitAt = pair.indexOf('=');
  const cookie: SentCookie = {
    value: decodeURIComponent(pair.slice(splitAt + 1)),
    secure: false,
    httpOnly: false,
  };
  for (const attribute of attributes) {
    const [key, value] = attribute.split('=');
    switch (key.toLowerCase()) {
      case 'path':
        cookie.path = value;
        break;
      case 'domain':
        cookie.domain = value;
        break;
      case 'max-age':
        cookie.maxAge = Number(value);
        break;
      case 'secure':
        cookie.secure = true;
        break;
      case 'httponly':
        cookie.httpOnly = true;
        break;
      case 'samesite':
        cookie.sameSite = value;
        break;
    }
  }
  return [pair.slice(0, splitAt), cookie];
}

/** Every cookie a response sets (or expires), by name, as the browser reads the Set-Cookie lines. */
export function sentCookies(response: { headers: Headers }): Map<string, SentCookie> {
  return new Map(response.headers.getSetCookie().map(parseSetCookie));
}

/**
 * Stands in for `cookies()` from next/headers inside a route handler. Reads come from a request's
 * Cookie header; writes go to a response's cookies, so a test sees the exact Set-Cookie lines the
 * browser would receive.
 */
export function fakeCookieStore(requestCookies: Record<string, string> = {}) {
  const cookie = Object.entries(requestCookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
  const request = new NextRequest('https://admin.yildizskylab.com/', { headers: { cookie } });
  const response = NextResponse.next();

  const store = {
    get: (name: string) => request.cookies.get(name),
    getAll: () => request.cookies.getAll(),
    has: (name: string) => request.cookies.has(name),
    set: (...args: Parameters<NextResponse['cookies']['set']>) => {
      response.cookies.set(...args);
      return store;
    },
    delete: (...args: Parameters<NextResponse['cookies']['delete']>) => {
      response.cookies.delete(...args);
      return store;
    },
  };

  return {
    store,
    /** The cookie this response sets (or expires) under `name`, as the browser reads it. */
    sent: (name: string) => sentCookies(response).get(name),
    /** Every cookie name this response sets or expires, sorted. */
    sentNames: () => [...sentCookies(response).keys()].sort(),
  };
}

/** A live session cookie as the browser should receive it. */
export function sessionCookie(value: string, maxAge: number, secure = true): SentCookie {
  return { value, maxAge, path: '/', secure, httpOnly: true, sameSite: 'lax' };
}

/** A Set-Cookie that makes the browser drop the cookie of that name and path. */
export function expiredCookie({ secure = true, path = '/' } = {}): SentCookie {
  return { value: '', maxAge: 0, path, secure, httpOnly: true, sameSite: 'lax' };
}

/** 7 days: the access token cookies. */
export const ACCESS_TOKEN_MAX_AGE = 604800;
/** 30 days: the refresh token cookie. */
export const REFRESH_TOKEN_MAX_AGE = 2592000;

/** With Secure cookies: the three `__Host-` session cookies plus every legacy unprefixed name. */
export const EVERY_SECURE_SESSION_COOKIE = [
  '__Host-access_token',
  '__Host-auth_token',
  '__Host-refresh_token',
  'access_token',
  'auth_token',
  'refresh_token',
  'token',
];
