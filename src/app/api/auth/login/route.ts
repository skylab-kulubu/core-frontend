import { NextResponse } from 'next/server';
import { getOAuth2AuthUrl } from '@/lib/auth/oauth2';
import { authCookieSecure } from '@/lib/auth/cookie-secure';
import {
  createOAuthTransaction,
  OAUTH_CODE_VERIFIER_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_TRANSACTION_MAX_AGE_SECONDS,
} from '@/lib/auth/oauth-transaction';

export async function GET(request: Request) {
  const transaction = createOAuthTransaction();
  const authUrl = getOAuth2AuthUrl(transaction.state, transaction.codeChallenge);
  const response = NextResponse.redirect(new URL(authUrl, request.url));

  if (!authUrl.startsWith('/')) {
    const options = {
      httpOnly: true,
      secure: authCookieSecure(),
      sameSite: 'lax' as const,
      maxAge: OAUTH_TRANSACTION_MAX_AGE_SECONDS,
      path: '/api/auth',
    };
    response.cookies.set(OAUTH_STATE_COOKIE, transaction.state, options);
    response.cookies.set(OAUTH_CODE_VERIFIER_COOKIE, transaction.codeVerifier, options);
  }

  return response;
}
