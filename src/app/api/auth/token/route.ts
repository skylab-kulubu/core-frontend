import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isJwtExpired } from '@/lib/auth/jwt-expiry';
import { RefreshTokenRejectedError } from '@/lib/auth/oauth2';
import { refreshSession } from '@/lib/auth/refresh-session';
import {
  clearSessionCookies,
  freshSessionAuthTime,
  readSessionAccessToken,
  readSessionRefreshToken,
} from '@/lib/auth/session-cookies';

export async function GET() {
  try {
    const cookieStore = await cookies();
    // A session past the panel's sign-in limit ends here, whatever its tokens say.
    if (freshSessionAuthTime(cookieStore) == null) {
      return NextResponse.json({ token: null }, { status: 401 });
    }
    const token = readSessionAccessToken(cookieStore);

    if (token && !isJwtExpired(token)) {
      return NextResponse.json({ token });
    }

    // Access token yoksa refresh token ile sessizce yenilemeyi dene.
    const refreshToken = readSessionRefreshToken(cookieStore);
    if (!refreshToken) {
      return NextResponse.json({ token: null }, { status: 401 });
    }

    try {
      // Keycloak's ID token, not the cookie, says when the admin signed in (refresh-session.ts).
      const accessToken = await refreshSession(cookieStore, refreshToken);
      if (!accessToken) return NextResponse.json({ token: null }, { status: 401 });
      return NextResponse.json({ token: accessToken });
    } catch (error) {
      if (error instanceof RefreshTokenRejectedError) clearSessionCookies(cookieStore);
      return NextResponse.json({ token: null }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ token: null }, { status: 401 });
  }
}
