import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import type { UserDto } from '@/types/api';
import { isJwtExpired } from '@/lib/auth/jwt-expiry';
import { refreshAccessToken } from '@/lib/auth/oauth2';
import { sessionUserFromAccessToken } from '@/lib/auth/session-user';
import { getTokenFromCookies } from '@/lib/auth/token';

function userFromAccessToken(token: string): UserDto | null {
  const session = sessionUserFromAccessToken(token);
  if (!session) return null;
  return {
    id: session.id,
    username: session.username,
    email: session.email,
    firstName: session.firstName,
    lastName: session.lastName,
    roles: session.roles,
    groups: session.groups,
  };
}

async function setSessionCookies(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  accessToken: string,
  refreshToken: string,
) {
  const secure = process.env.NODE_ENV === 'production';
  cookieStore.set('auth_token', accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  cookieStore.set('access_token', accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  cookieStore.set('refresh_token', refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
}

async function jitShadowUser(token: string): Promise<void> {
  const base = process.env.NEXT_PUBLIC_API_URL || 'https://api.yildizskylab.com';
  try {
    await fetch(`${base}/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return;
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    let token = getTokenFromCookies(cookieStore);

    if (!token || isJwtExpired(token)) {
      const refreshToken = cookieStore.get('refresh_token')?.value;
      if (!refreshToken) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
      }
      try {
        const refreshed = await refreshAccessToken(refreshToken);
        token = refreshed.access_token;
        await setSessionCookies(cookieStore, refreshed.access_token, refreshed.refresh_token);
      } catch {
        return NextResponse.json({ authenticated: false }, { status: 401 });
      }
    }

    const user = userFromAccessToken(token);
    if (!user) {
      cookieStore.delete('auth_token');
      cookieStore.delete('refresh_token');
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    await jitShadowUser(token);
    return NextResponse.json({ authenticated: true, user });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
