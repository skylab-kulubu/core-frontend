import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import type { UserDto } from '@/types/api';
import { CORE_API_URL } from '@/lib/api/core';
import { isJwtExpired } from '@/lib/auth/jwt-expiry';
import { refreshAccessToken, RefreshTokenRejectedError } from '@/lib/auth/oauth2';
import { sessionUserFromAccessToken } from '@/lib/auth/session-user';
import { clubRoleLabel } from '@/lib/chrome-role';
import type { ProfilePicture } from '@/lib/profile-picture';
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

/**
 * Reads the caller's own Core profile, which also creates their shadow on a first visit.
 * Only the picture is taken from it; the token stays the source of everything else.
 */
async function ownProfilePicture(token: string): Promise<ProfilePicture> {
  try {
    const response = await fetch(`${CORE_API_URL}/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return {};
    const profile = (await response.json()) as ProfilePicture;
    return {
      profilePictureUrl: profile.profilePictureUrl || undefined,
      profilePictureSizes: profile.profilePictureSizes || undefined,
    };
  } catch {
    return {};
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

    const picture = await ownProfilePicture(token);
    if (picture.profilePictureUrl) {
      user.profilePictureUrl = picture.profilePictureUrl;
      if (picture.profilePictureSizes) user.profilePictureSizes = picture.profilePictureSizes;
    }
    // roleLabel is the sidebar's team or role line, for the static playground that cannot work it out itself
    return NextResponse.json({
      authenticated: true,
      user,
      roleLabel: clubRoleLabel(user.groups ?? []),
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
