import { NextResponse } from 'next/server';
import { getOAuth2AuthUrl } from '@/lib/auth/oauth2';

export async function GET(request: Request) {
  const authUrl = getOAuth2AuthUrl();
  return NextResponse.redirect(new URL(authUrl, request.url));
}
