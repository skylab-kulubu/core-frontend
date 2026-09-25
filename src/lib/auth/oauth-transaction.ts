import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  authCookieName,
  authCookieOptions,
  expireAuthCookie,
  type CookieReader,
  type CookieWriter,
} from '@/lib/auth/cookie-secure';

/**
 * Base names of the login transaction cookies; `authCookieName` adds `__Host-` when cookies are
 * Secure, so a sibling subdomain cannot plant a state and verifier of its own (login CSRF).
 */
const OAUTH_TRANSACTION_BASE_NAMES = {
  state: 'oauth_state',
  codeVerifier: 'oauth_code_verifier',
} as const;

const OAUTH_TRANSACTION_MAX_AGE_SECONDS = 10 * 60;

/** Before the `__Host-` prefix the transaction cookies lived under this path, not `/`. */
const LEGACY_OAUTH_TRANSACTION_PATH = '/api/auth';

/** The login transaction's cookie names (see `authCookieName` for why they carry `__Host-`). */
export function oauthTransactionCookieNames() {
  return {
    state: authCookieName(OAUTH_TRANSACTION_BASE_NAMES.state),
    codeVerifier: authCookieName(OAUTH_TRANSACTION_BASE_NAMES.codeVerifier),
  };
}

/** Keeps the state and PKCE verifier until the callback, for at most 10 minutes. */
export function writeOAuthTransactionCookies(
  cookies: CookieWriter,
  transaction: { state: string; codeVerifier: string },
): void {
  const names = oauthTransactionCookieNames();
  const options = authCookieOptions(OAUTH_TRANSACTION_MAX_AGE_SECONDS);
  cookies.set(names.state, transaction.state, options);
  cookies.set(names.codeVerifier, transaction.codeVerifier, options);
}

/**
 * The state and PKCE verifier the login left behind, under the current names only: when cookies
 * are Secure an unprefixed pair is ignored, because a sibling subdomain could have planted it.
 */
export function readOAuthTransactionCookies(cookies: CookieReader): {
  state: string | undefined;
  codeVerifier: string | undefined;
} {
  const names = oauthTransactionCookieNames();
  return {
    state: cookies.get(names.state)?.value,
    codeVerifier: cookies.get(names.codeVerifier)?.value,
  };
}

/**
 * Ends the login transaction (the state and verifier are single-use), and expires the legacy
 * unprefixed pair at its old path. On local http the names are the same, and a response carries one
 * Set-Cookie per name, so there only the current cookies are expired; the old ones lapse within
 * 10 minutes anyway.
 */
export function clearOAuthTransactionCookies(cookies: CookieWriter): void {
  const current = Object.values(oauthTransactionCookieNames());
  for (const name of current) {
    expireAuthCookie(cookies, name);
  }
  for (const name of Object.values(OAUTH_TRANSACTION_BASE_NAMES)) {
    if (!current.includes(name)) expireAuthCookie(cookies, name, LEGACY_OAUTH_TRANSACTION_PATH);
  }
}

export function createOAuthTransaction(): {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
} {
  const state = randomBytes(32).toString('base64url');
  const codeVerifier = randomBytes(64).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

  return { state, codeVerifier, codeChallenge };
}

export function oauthStateMatches(actual: string | null, expected: string | undefined): boolean {
  if (!actual || !expected) return false;

  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
