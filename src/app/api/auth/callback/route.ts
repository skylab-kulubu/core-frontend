import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken } from '@/lib/auth/oauth2';
import { cookies } from 'next/headers';
import {
  clearOAuthTransactionCookies,
  oauthStateMatches,
  readOAuthTransactionCookies,
} from '@/lib/auth/oauth-transaction';
import { expireLegacySessionCookies, writeSessionCookies } from '@/lib/auth/session-cookies';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');
  const cookieStore = await cookies();
  const { state: expectedState, codeVerifier } = readOAuthTransactionCookies(cookieStore);
  clearOAuthTransactionCookies(cookieStore);

  if (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(new URL('/login?error=' + encodeURIComponent(error), request.url));
  }

  if (!code) {
    console.error('No authorization code provided');
    return NextResponse.redirect(new URL('/login?error=no_code', request.url));
  }

  if (!oauthStateMatches(state, expectedState)) {
    console.error('OAuth state validation failed');
    return NextResponse.redirect(new URL('/login?error=invalid_state', request.url));
  }

  if (!codeVerifier) {
    console.error('OAuth PKCE verifier is missing');
    return NextResponse.redirect(new URL('/login?error=missing_code_verifier', request.url));
  }

  try {
    const { access_token, refresh_token } = await exchangeCodeForToken(code, codeVerifier);

    console.log('✅ OAuth callback: Token exchange başarılı');
    console.log('Token uzunlukları:', {
      access_token: access_token?.length,
      refresh_token: refresh_token?.length,
    });

    writeSessionCookies(cookieStore, access_token, refresh_token);
    expireLegacySessionCookies(cookieStore);

    console.log("✅ OAuth callback: Cookie'ler set edildi, dashboard'a yönlendiriliyor");

    // Redirect URL'ini belirle
    // Docker/Proxy arkasında request.url localhost olabilir, bu yüzden env var'dan almayı dene
    let baseUrl = request.nextUrl.origin;
    const appUrl = process.env.APP_URL;
    const redirectUri = process.env.OAUTH2_REDIRECT_URI;

    if (appUrl) {
      baseUrl = appUrl;
    } else if (redirectUri) {
      try {
        const url = new URL(redirectUri);
        baseUrl = url.origin;
      } catch (e) {
        console.error('Invalid OAUTH2_REDIRECT_URI', e);
      }
    }

    const redirectUrl = new URL('/dashboard', baseUrl);
    console.log('Redirecting to:', redirectUrl.toString());

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('❌ OAuth callback: Token exchange başarısız:', error);
    const errorMessage = error instanceof Error ? error.message : 'unknown_error';
    return NextResponse.redirect(
      new URL(
        '/login?error=token_exchange_failed&details=' + encodeURIComponent(errorMessage),
        request.url,
      ),
    );
  }
}
