import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authCookieSecure } from '@/lib/auth/cookie-secure';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    // Cookie'leri temizle - hem delete hem de set ile maxAge 0 kullan
    // Bazı tarayıcılarda delete çalışmayabilir, bu yüzden her ikisini de yapıyoruz

    // Önce delete ile sil
    cookieStore.delete('auth_token');
    cookieStore.delete('access_token');
    cookieStore.delete('refresh_token');

    // Sonra set ile maxAge 0 ile geçersizleştir
    const secure = authCookieSecure();
    cookieStore.set('auth_token', '', {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
      expires: new Date(0),
    });

    cookieStore.set('access_token', '', {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
      expires: new Date(0),
    });

    cookieStore.set('refresh_token', '', {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
      expires: new Date(0),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
