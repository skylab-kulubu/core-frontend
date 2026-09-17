import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTokenFromCookies } from '@/lib/auth/token';
import { isJwtExpired } from '@/lib/auth/jwt-expiry';
import { refreshAccessToken } from '@/lib/auth/oauth2';
import { authCookieSecure } from '@/lib/auth/cookie-secure';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = getTokenFromCookies(cookieStore);

    if (token && !isJwtExpired(token)) {
      return NextResponse.json({ token });
    }

    // Access token yoksa refresh token ile sessizce yenilemeyi dene.
    const refreshToken = cookieStore.get('refresh_token')?.value;
    if (!refreshToken) {
      return NextResponse.json({ token: null }, { status: 401 });
    }

    const { access_token, refresh_token } = await refreshAccessToken(refreshToken);
    const secure = authCookieSecure();

    cookieStore.set('auth_token', access_token, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    cookieStore.set('access_token', access_token, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    cookieStore.set('refresh_token', refresh_token, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    return NextResponse.json({ token: access_token });
  } catch (error) {
    return NextResponse.json({ token: null }, { status: 401 });
  }
}
