import {
  authCookieName,
  authCookieOptions,
  expireAuthCookie,
  type CookieReader,
  type CookieWriter,
} from '@/lib/auth/cookie-secure';

/**
 * Base names of the session cookies; `authCookieName` adds `__Host-` when cookies are Secure.
 * `auth_token` and `access_token` carry the same access token. The pair predates this module
 * (older code read either name) and is kept for compatibility, so the prefix is the only change.
 */
const SESSION_COOKIE_BASE_NAMES = {
  authToken: 'auth_token',
  accessToken: 'access_token',
  refreshToken: 'refresh_token',
} as const;

/** Read by older builds but never issued; only ever cleared. */
const READ_ONLY_LEGACY_BASE_NAMES = ['token'];

/** The admin session's cookie names (see `authCookieName` for why they carry `__Host-`). */
export function sessionCookieNames() {
  return {
    authToken: authCookieName(SESSION_COOKIE_BASE_NAMES.authToken),
    accessToken: authCookieName(SESSION_COOKIE_BASE_NAMES.accessToken),
    refreshToken: authCookieName(SESSION_COOKIE_BASE_NAMES.refreshToken),
  };
}

/** Names the session used before the `__Host-` prefix that differ from today's names. */
function legacySessionCookieNames(): string[] {
  const current = new Set(Object.values(sessionCookieNames()));
  return [...Object.values(SESSION_COOKIE_BASE_NAMES), ...READ_ONLY_LEGACY_BASE_NAMES].filter(
    (name) => !current.has(name),
  );
}

/**
 * The session's access token. Only the current names count: an unprefixed cookie is ignored when
 * the session is Secure, because a sibling subdomain could have planted it.
 */
export function readSessionAccessToken(cookies: CookieReader): string | null {
  const names = sessionCookieNames();
  return cookies.get(names.authToken)?.value || cookies.get(names.accessToken)?.value || null;
}

/** The session's refresh token, under the current name only (see `readSessionAccessToken`). */
export function readSessionRefreshToken(cookies: CookieReader): string | null {
  return cookies.get(sessionCookieNames().refreshToken)?.value || null;
}

const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Stores a (new or refreshed) session: the access token under both names, and the refresh token. */
export function writeSessionCookies(
  cookies: CookieWriter,
  accessToken: string,
  refreshToken: string,
): void {
  const names = sessionCookieNames();
  const accessTokenOptions = authCookieOptions(ACCESS_TOKEN_MAX_AGE_SECONDS);
  cookies.set(names.authToken, accessToken, accessTokenOptions);
  cookies.set(names.accessToken, accessToken, accessTokenOptions);
  cookies.set(names.refreshToken, refreshToken, authCookieOptions(REFRESH_TOKEN_MAX_AGE_SECONDS));
}

/**
 * Expires the legacy unprefixed session cookies so they do not linger after a new sign-in. Names
 * that equal today's (plain names on local http) are left alone: expiring them would drop the
 * session just written.
 */
export function expireLegacySessionCookies(cookies: CookieWriter): void {
  for (const name of legacySessionCookieNames()) {
    expireAuthCookie(cookies, name);
  }
}

/** Ends the session in the browser: expires the current cookies and the legacy unprefixed ones. */
export function clearSessionCookies(cookies: CookieWriter): void {
  for (const name of Object.values(sessionCookieNames())) {
    expireAuthCookie(cookies, name);
  }
  expireLegacySessionCookies(cookies);
}
