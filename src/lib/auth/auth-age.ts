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

/**
 * The `auth_time` of an ID token issued to `clientId`, or `null`. The token comes straight from
 * Keycloak's token endpoint over TLS in exchange for this login's code and PKCE verifier, so its
 * signature is not checked here (OIDC Core 3.1.3.7, item 6); its audience is.
 */
export function idTokenAuthTime(idToken: unknown, clientId: string): number | null {
  if (typeof idToken !== 'string') return null;
  const payload = idToken.split('.')[1];
  if (!payload) return null;
  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!claims || typeof claims !== 'object') return null;
  const { aud, auth_time: authTime } = claims as { aud?: unknown; auth_time?: unknown };
  const audiences = Array.isArray(aud) ? aud : [aud];
  if (!clientId || !audiences.includes(clientId)) return null;
  return typeof authTime === 'number' && Number.isSafeInteger(authTime) ? authTime : null;
}
