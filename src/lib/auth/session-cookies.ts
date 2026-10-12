import { authTimeIsFresh, jwtAuthTime, sessionSecondsLeft } from '@/lib/auth/auth-age';
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
 * `session_auth_time` holds when the admin signed in at Keycloak (the ID token's `auth_time`), which
 * bounds the session (see `auth-age.ts`).
 */
const SESSION_COOKIE_BASE_NAMES = {
  authToken: 'auth_token',
  accessToken: 'access_token',
  refreshToken: 'refresh_token',
  authTime: 'session_auth_time',
} as const;

/** The names the session used before the `__Host-` prefix; `token` was read but never issued. */
const LEGACY_BASE_NAMES = ['auth_token', 'access_token', 'refresh_token', 'token'];

/** The admin session's cookie names (see `authCookieName` for why they carry `__Host-`). */
export function sessionCookieNames() {
  return {
    authToken: authCookieName(SESSION_COOKIE_BASE_NAMES.authToken),
    accessToken: authCookieName(SESSION_COOKIE_BASE_NAMES.accessToken),
    refreshToken: authCookieName(SESSION_COOKIE_BASE_NAMES.refreshToken),
    authTime: authCookieName(SESSION_COOKIE_BASE_NAMES.authTime),
  };
}

/** Names the session used before the `__Host-` prefix that differ from today's names. */
function legacySessionCookieNames(): string[] {
  const current = new Set(Object.values(sessionCookieNames()));
  return LEGACY_BASE_NAMES.filter((name) => !current.has(name));
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

/**
 * When the session's admin signed in at Keycloak (epoch seconds), or `null` when unknown. The
 * cookie is only a hint the browser could change: when the access token carries Keycloak's own
 * `auth_time` the older of the two counts (a forged access token gains nothing, core refuses it),
 * and every refresh replaces the cookie with Keycloak's value (`refresh-session.ts`).
 */
export function readSessionAuthTime(cookies: CookieReader): number | null {
  const value = cookies.get(sessionCookieNames().authTime)?.value;
  if (!value || !/^\d{1,12}$/.test(value)) return null;
  const tokenAuthTime = jwtAuthTime(readSessionAccessToken(cookies));
  return tokenAuthTime == null ? Number(value) : Math.min(Number(value), tokenAuthTime);
}

/**
 * The session's sign-in time while it is within the panel's limit (8 hours, `auth-age.ts`), else
 * `null`. A session past the limit, or one without a sign-in time (started before the limit
 * existed), is ended here: its cookies are expired so no later request refreshes it either.
 */
export function freshSessionAuthTime(cookies: CookieReader & CookieWriter): number | null {
  const authTime = readSessionAuthTime(cookies);
  if (authTimeIsFresh(authTime)) return authTime;
  if (readSessionAccessToken(cookies) || readSessionRefreshToken(cookies)) {
    clearSessionCookies(cookies);
  }
  return null;
}

/**
 * Stores a new or refreshed session: the access token under both names, the refresh token, and the
 * sign-in time. Every cookie lives only as long as the sign-in is accepted, counted from `authTime`,
 * so a refresh rotates the tokens without extending the session.
 */
export function writeSessionCookies(
  cookies: CookieWriter,
  accessToken: string,
  refreshToken: string,
  authTime: number,
): void {
  const names = sessionCookieNames();
  const options = authCookieOptions(Math.max(0, sessionSecondsLeft(authTime)));
  cookies.set(names.authToken, accessToken, options);
  cookies.set(names.accessToken, accessToken, options);
  cookies.set(names.refreshToken, refreshToken, options);
  cookies.set(names.authTime, String(authTime), options);
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
