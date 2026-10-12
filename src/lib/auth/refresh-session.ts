import { checkIdToken } from '@/lib/auth/auth-age';
import type { CookieWriter } from '@/lib/auth/cookie-secure';
import { oauthClientId, oauthIssuer, refreshAccessToken } from '@/lib/auth/oauth2';
import { clearSessionCookies, writeSessionCookies } from '@/lib/auth/session-cookies';

/**
 * Refreshes the session at Keycloak and stores the new tokens. The sign-in time comes from the ID
 * token Keycloak returns with the refresh (the login asked for `openid`), never from the cookie,
 * which the browser can change: a session whose cookie was moved forward ends at the first refresh.
 *
 * Returns the new access token, or `null` when that ID token is missing, not the panel's, or its
 * sign-in is older than the panel accepts; the session is then ended (its cookies expired). Throws
 * what `refreshAccessToken` throws, so the caller decides whether that failure ends the session.
 */
export async function refreshSession(
  cookies: CookieWriter,
  refreshToken: string,
): Promise<string | null> {
  const refreshed = await refreshAccessToken(refreshToken);
  const check = checkIdToken(refreshed.id_token, {
    issuer: oauthIssuer(),
    clientId: oauthClientId(),
  });
  if (!('authTime' in check)) {
    console.error('Token refresh: ID token refused:', check.refused);
    clearSessionCookies(cookies);
    return null;
  }
  writeSessionCookies(cookies, refreshed.access_token, refreshed.refresh_token, check.authTime);
  return refreshed.access_token;
}
