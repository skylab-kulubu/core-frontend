import { cookies } from 'next/headers';
import { isJwtExpired } from '@/lib/auth/jwt-expiry';
import { refreshAccessToken } from '@/lib/auth/oauth2';
import {
  freshSessionAuthTime,
  readSessionAccessToken,
  readSessionRefreshToken,
  writeSessionCookies,
} from '@/lib/auth/session-cookies';

/**
 * The signed-in admin's access token for server-to-server calls (route handlers only: it may
 * rotate the httpOnly session cookies). Refreshes an expired token the same way
 * `/api/auth/token` does, and like it ends a session past the panel's sign-in limit; `null` means
 * there is no usable session.
 */
export async function serverAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const authTime = freshSessionAuthTime(cookieStore);
  if (authTime == null) return null;
  const token = readSessionAccessToken(cookieStore);
  if (token && !isJwtExpired(token)) return token;

  const refreshToken = readSessionRefreshToken(cookieStore);
  if (!refreshToken) return null;
  try {
    const refreshed = await refreshAccessToken(refreshToken);
    writeSessionCookies(cookieStore, refreshed.access_token, refreshed.refresh_token, authTime);
    return refreshed.access_token;
  } catch {
    return null;
  }
}
