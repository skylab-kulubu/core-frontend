import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { readSessionAccessToken, readSessionRefreshToken } from '@/lib/auth/session-cookies';

export default async function RootPage() {
  const cookieStore = await cookies();
  const token = readSessionAccessToken(cookieStore);
  const refreshToken = readSessionRefreshToken(cookieStore);

  // Erişim yoksa login. Süresi dolmuş access JWT olsa bile refresh cookie varsa dashboard'a
  // gidip `/api/auth/me` sessiz yenilemesine bırak (OAuth ping-pong döngüsünü keser).
  if (!token && !refreshToken) {
    redirect('/login');
  }

  redirect('/dashboard');
}
