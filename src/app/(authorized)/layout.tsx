import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { GlobalErrorMessenger } from '@/components/common/GlobalErrorMessenger';
import { AuthenticatedChrome } from '@/components/layout/AuthenticatedChrome';
import { AuthProvider } from '@/context/AuthContext';
import { getTokenFromCookies } from '@/lib/auth/token';
import { sessionUserFromAccessToken } from '@/lib/auth/session-user';
import type { UserDto } from '@/types/api';

export const dynamic = 'force-dynamic';

export default async function AuthorizedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const token = getTokenFromCookies(cookieStore);
  const refreshToken = cookieStore.get('refresh_token')?.value;

  if (!token && !refreshToken) {
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
    <AuthProvider initialUser={user}>
      <AuthenticatedChrome sidebarUser={user}>
        <GlobalErrorMessenger />
        {children}
      </AuthenticatedChrome>
    </AuthProvider>
  );
}
