import { NextResponse } from 'next/server';
import { getOAuth2AuthUrl } from '@/lib/auth/oauth2';
import { createOAuthTransaction, writeOAuthTransactionCookies } from '@/lib/auth/oauth-transaction';

export async function GET(request: Request) {
  const transaction = createOAuthTransaction();
  const authUrl = getOAuth2AuthUrl(transaction.state, transaction.codeChallenge);
  const response = NextResponse.redirect(new URL(authUrl, request.url));

  if (!authUrl.startsWith('/')) {
    writeOAuthTransactionCookies(response.cookies, transaction);
  }

  return response;
}
