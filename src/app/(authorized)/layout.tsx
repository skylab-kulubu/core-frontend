import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { GlobalErrorMessenger } from '@/components/common/GlobalErrorMessenger';
import { AuthenticatedChrome } from '@/components/layout/AuthenticatedChrome';
import { AuthProvider } from '@/context/AuthContext';
import { sessionSecondsLeft } from '@/lib/auth/auth-age';
import {
  readSessionAccessToken,
  readSessionAuthTime,
  readSessionRefreshToken,
} from '@/lib/auth/session-cookies';
import { sessionUserFromAccessToken } from '@/lib/auth/session-user';
import type { UserDto } from '@/types/api';

export const dynamic = 'force-dynamic';

export default async function AuthorizedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const token = readSessionAccessToken(cookieStore);
  const refreshToken = readSessionRefreshToken(cookieStore);

  if (!token && !refreshToken) {
    redirect('/login');
  }

  // Seconds until the panel stops accepting this sign-in (auth-age.ts); the page leaves for the
  // login then, and a refresh does not move it.
  const sessionExpiresIn = sessionSecondsLeft(readSessionAuthTime(cookieStore));
  if (sessionExpiresIn <= 0) {
    redirect('/login');
  }

  const session = sessionUserFromAccessToken(token);
  if (!session) {
    redirect('/login');
  }

  const user: UserDto = {
    id: session.id,
    username: session.username,
    email: session.email,
    firstName: session.firstName,
    lastName: session.lastName,
    roles: session.roles,
    groups: session.groups,
  };
  return (
    <AuthProvider initialUser={user} sessionExpiresIn={sessionExpiresIn}>
      <AuthenticatedChrome sidebarUser={user}>
        <GlobalErrorMessenger />
        {children}
      </AuthenticatedChrome>
    </AuthProvider>
  );
}
