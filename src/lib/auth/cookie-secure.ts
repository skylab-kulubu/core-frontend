/**
 * Whether superadmin's auth cookies (the session and the OAuth login transaction) are Secure and
 * therefore carry the `__Host-` prefix.
 *
 * - `AUTH_COOKIE_SECURE` set to a non-empty value: true only for the exact string `true`. Every
 *   other value (`1`, `TRUE`, `yes`, `false`) is false and turns Secure and the prefix off.
 * - `AUTH_COOKIE_SECURE` unset or empty: `NODE_ENV === 'production'`. The Docker image runs with
 *   `NODE_ENV=production`, so production and sandbox (both behind HTTPS) are Secure unless the
 *   variable says otherwise; `next dev` is not.
 */
export function authCookieSecure(): boolean {
  const raw = process.env.AUTH_COOKIE_SECURE;
  if (raw != null && raw !== '') {
    return raw === 'true';
  }
  return process.env.NODE_ENV === 'production';
}

/**
 * `base` with the `__Host-` prefix when auth cookies are Secure. The browser then accepts the cookie
 * only from this host, Secure, with `Path=/` and no `Domain`, so a sibling subdomain under
 * yildizskylab.com cannot plant or shadow it. Local http cannot use the prefix (it requires Secure),
 * so there the name stays `base`.
 */
export function authCookieName(base: string): string {
  return authCookieSecure() ? `__Host-${base}` : base;
}

/** Anything that reads request cookies: `cookies()` from next/headers or `NextRequest.cookies`. */
export type CookieReader = { get(name: string): { value: string } | undefined };

export type AuthCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
  expires?: Date;
};

/** Anything that writes response cookies: `cookies()` in a route handler or `NextResponse.cookies`. */
export type CookieWriter = {
  set(name: string, value: string, options: AuthCookieOptions): unknown;
};

/** Options every auth cookie shares; `Path=/` is what a `__Host-` cookie requires. */
export function authCookieOptions(maxAge: number): AuthCookieOptions {
  return { httpOnly: true, secure: authCookieSecure(), sameSite: 'lax', path: '/', maxAge };
}

/**
 * Makes the browser drop the cookie `name` at `path`. The Set-Cookie is Secure whenever auth
 * cookies are: a bare `delete()` omits Secure, and the browser ignores it for a `__Host-` name.
 */
export function expireAuthCookie(cookies: CookieWriter, name: string, path = '/'): void {
  cookies.set(name, '', { ...authCookieOptions(0), path, expires: new Date(0) });
}
