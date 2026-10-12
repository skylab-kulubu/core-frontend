/**
 * How old a sign-in the panel accepts (OIDC `max_age` and the ID token's `auth_time`).
 *
 * An admin may keep a long Keycloak session ("stay signed in" holds it for 30 days), but the panel
 * accepts a sign-in for at most 8 hours: the login asks Keycloak for `max_age`, the callback checks
 * the ID token's `auth_time` (OIDC Core 3.1.2.1 makes the client check it when it sent `max_age`),
 * and the panel's session ends 8 hours after that sign-in however often its tokens are refreshed.
 */
export const PANEL_MAX_AUTH_AGE_SECONDS = 8 * 60 * 60;

/**
 * Keycloak writes `auth_time` by its clock and this server compares it with its own. Keycloak
 * accepts an SSO session for `max_age` by its clock, so without a tolerance a server whose clock runs
 * a little ahead would refuse a sign-in Keycloak just accepted. One minute covers NTP-synced hosts;
 * the session then lasts at most 8 hours and 1 minute.
 */
export const AUTH_TIME_CLOCK_SKEW_SECONDS = 60;

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Seconds left for a session whose sign-in was at `authTime` (epoch seconds). Zero or less: the
 * session is over. A missing or malformed time, or one further in the future than the clock
 * tolerance, counts as no sign-in at all.
 */
export function sessionSecondsLeft(
  authTime: number | null | undefined,
  now: number = nowSeconds(),
): number {
  if (typeof authTime !== 'number' || !Number.isSafeInteger(authTime) || authTime <= 0) return 0;
  if (authTime > now + AUTH_TIME_CLOCK_SKEW_SECONDS) return 0;
  return authTime + PANEL_MAX_AUTH_AGE_SECONDS + AUTH_TIME_CLOCK_SKEW_SECONDS - now;
}

/** Whether a sign-in at `authTime` is still within the panel's limit. */
export function authTimeIsFresh(authTime: number | null | undefined, now?: number): boolean {
  return sessionSecondsLeft(authTime, now) > 0;
}

/** The claims of a JWT, read without checking its signature; `null` when it is not one. */
export function jwtClaims(token: unknown): Record<string, unknown> | null {
  if (typeof token !== 'string') return null;
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return claims && typeof claims === 'object' ? (claims as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** A JWT's `auth_time` when it carries a whole number there, else `null`. */
export function jwtAuthTime(token: unknown): number | null {
  const authTime = jwtClaims(token)?.auth_time;
  return typeof authTime === 'number' && Number.isSafeInteger(authTime) ? authTime : null;
}

export type IdTokenCheck =
  | { authTime: number }
  | { refused: 'unreadable' | 'issuer' | 'audience' | 'expired' | 'no_auth_time' | 'stale' };

/**
 * Checks the ID token Keycloak returned with a login or a refresh (OIDC Core 3.1.3.7): issued by
 * `issuer` to `clientId` (`aud`, and `azp` when present or when there are several audiences), not
 * expired, with an `auth_time` the panel still accepts. The token comes straight from Keycloak's
 * token endpoint over TLS, so its signature is not checked (item 6).
 */
export function checkIdToken(
  idToken: unknown,
  expected: { issuer: string; clientId: string },
  now: number = nowSeconds(),
): IdTokenCheck {
  const claims = jwtClaims(idToken);
  if (!claims) return { refused: 'unreadable' };
  const issuer = expected.issuer.replace(/\/+$/, '');
  if (!issuer || claims.iss !== issuer) return { refused: 'issuer' };
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const azpRequired = audiences.length > 1 || claims.azp !== undefined;
  if (
    !expected.clientId ||
    !audiences.includes(expected.clientId) ||
    (azpRequired && claims.azp !== expected.clientId)
  ) {
    return { refused: 'audience' };
  }
  if (typeof claims.exp !== 'number' || claims.exp <= now - AUTH_TIME_CLOCK_SKEW_SECONDS) {
    return { refused: 'expired' };
  }
  const authTime = jwtAuthTime(idToken);
  if (authTime == null) return { refused: 'no_auth_time' };
  if (!authTimeIsFresh(authTime, now)) return { refused: 'stale' };
  return { authTime };
}
