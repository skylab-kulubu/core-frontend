import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import type { UserDto } from '@/types/api';
import { CORE_API_URL } from '@/lib/api/core';
import { isJwtExpired } from '@/lib/auth/jwt-expiry';
import { refreshAccessToken, RefreshTokenRejectedError } from '@/lib/auth/oauth2';
import { sessionUserFromAccessToken } from '@/lib/auth/session-user';
import {
  clearSessionCookies,
  readSessionAccessToken,
  readSessionRefreshToken,
  writeSessionCookies,
} from '@/lib/auth/session-cookies';

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

async function jitShadowUser(token: string): Promise<void> {
  const base = CORE_API_URL;
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
    let token = readSessionAccessToken(cookieStore);

    if (!token || isJwtExpired(token)) {
      const refreshToken = readSessionRefreshToken(cookieStore);
      if (!refreshToken) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
      }
      try {
        const refreshed = await refreshAccessToken(refreshToken);
        token = refreshed.access_token;
        writeSessionCookies(cookieStore, refreshed.access_token, refreshed.refresh_token);
      } catch (error) {
        if (error instanceof RefreshTokenRejectedError) clearSessionCookies(cookieStore);
        return NextResponse.json({ authenticated: false }, { status: 401 });
      }
    }

    const user = userFromAccessToken(token);
    if (!user) {
      clearSessionCookies(cookieStore);
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    await jitShadowUser(token);
    return NextResponse.json({ authenticated: true, user });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
