import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isJwtExpired, jwtSecondsLeft } from '@/lib/auth/jwt-expiry';
import { RefreshTokenRejectedError } from '@/lib/auth/oauth2';
import { refreshSession } from '@/lib/auth/refresh-session';
import {
  clearSessionCookies,
  freshSessionAuthTime,
  readSessionAccessToken,
  readSessionRefreshToken,
} from '@/lib/auth/session-cookies';

/** Every answer: a token is never stored by the browser or a proxy (RFC 6749 §5.1). */
function answer(body: { token: string | null; expiresIn?: number | null }, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** The token and how many seconds it has left, so the page reuses it until then (access-token.ts). */
function tokenAnswer(token: string) {
  return answer({ token, expiresIn: jwtSecondsLeft(token) });
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    // A session past the panel's sign-in limit ends here, whatever its tokens say.
    if (freshSessionAuthTime(cookieStore) == null) {
      return answer({ token: null }, 401);
    }
    const token = readSessionAccessToken(cookieStore);

    if (token && !isJwtExpired(token)) {
      return tokenAnswer(token);
    }

    // Access token yoksa refresh token ile sessizce yenilemeyi dene.
    const refreshToken = readSessionRefreshToken(cookieStore);
    if (!refreshToken) {
      return answer({ token: null }, 401);
    }

    try {
      // Keycloak's ID token, not the cookie, says when the admin signed in (refresh-session.ts).
      const accessToken = await refreshSession(cookieStore, refreshToken);
      if (!accessToken) return answer({ token: null }, 401);
      return tokenAnswer(accessToken);
    } catch (error) {
      if (error instanceof RefreshTokenRejectedError) clearSessionCookies(cookieStore);
      return answer({ token: null }, 401);
    }
  } catch {
    return answer({ token: null }, 401);
  }
}
