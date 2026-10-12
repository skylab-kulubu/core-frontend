import { cookies } from 'next/headers';
import { isJwtExpired } from '@/lib/auth/jwt-expiry';
import { refreshSession } from '@/lib/auth/refresh-session';
import {
  freshSessionAuthTime,
  readSessionAccessToken,
  readSessionRefreshToken,
} from '@/lib/auth/session-cookies';

/**
 * The signed-in admin's access token for server-to-server calls (route handlers only: it may
 * rotate the httpOnly session cookies). Refreshes an expired token the same way
 * `/api/auth/token` does, and like it ends a session past the panel's sign-in limit; `null` means
 * there is no usable session.
 */
export async function serverAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  if (freshSessionAuthTime(cookieStore) == null) return null;
  const token = readSessionAccessToken(cookieStore);
  if (token && !isJwtExpired(token)) return token;

  const refreshToken = readSessionRefreshToken(cookieStore);
  if (!refreshToken) return null;
  try {
    // Keycloak's ID token, not the cookie, says when the admin signed in (refresh-session.ts).
    return await refreshSession(cookieStore, refreshToken);
  } catch {
    return null;
  }
}
