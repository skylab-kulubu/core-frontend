import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clearSessionCookies } from '@/lib/auth/session-cookies';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    // Oturum cookie'lerini (güncel __Host- adları ve eski öneksiz adlar) maxAge 0 ile geçersizleştir.
    clearSessionCookies(cookieStore);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
