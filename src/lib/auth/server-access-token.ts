import { cookies } from 'next/headers';
import { authCookieSecure } from '@/lib/auth/cookie-secure';
import { isJwtExpired } from '@/lib/auth/jwt-expiry';
import { refreshAccessToken } from '@/lib/auth/oauth2';
import { getTokenFromCookies } from '@/lib/auth/token';

/**
 * The signed-in admin's access token for server-to-server calls (route handlers only: it may
 * rotate the httpOnly session cookies). Refreshes an expired token the same way
 * `/api/auth/token` does; `null` means there is no usable session.
 */
export async function serverAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = getTokenFromCookies(cookieStore);
  if (token && !isJwtExpired(token)) return token;

  const refreshToken = cookieStore.get('refresh_token')?.value;
  if (!refreshToken) return null;
  try {
    const refreshed = await refreshAccessToken(refreshToken);
    const secure = authCookieSecure();
    const session = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };
    cookieStore.set('auth_token', refreshed.access_token, { ...session, maxAge: 60 * 60 * 24 * 7 });
    cookieStore.set('access_token', refreshed.access_token, {
      ...session,
      maxAge: 60 * 60 * 24 * 7,
    });
    cookieStore.set('refresh_token', refreshed.refresh_token, {
      ...session,
      maxAge: 60 * 60 * 24 * 30,
    });
    return refreshed.access_token;
  } catch {
    return null;
  }
}
