/** @jest-environment node */

import { GET } from '@/app/api/auth/login/route';
import { sentCookies } from '@/test/server/cookie-store';
import { saveEnv } from '@/test/server/env';

/** 10 minutes: how long a login may take between /api/auth/login and the callback. */
const OAUTH_TRANSACTION_MAX_AGE = 600;

describe('OAuth login route', () => {
  afterEach(
    saveEnv('AUTH_COOKIE_SECURE', 'OAUTH2_ISSUER', 'OAUTH2_CLIENT_ID', 'OAUTH2_REDIRECT_URI'),
  );

  beforeEach(() => {
    delete process.env.OAUTH2_ISSUER;
    delete process.env.OAUTH2_CLIENT_ID;
    delete process.env.OAUTH2_REDIRECT_URI;
  });

  it('turns the local configuration error path into an absolute redirect', async () => {
    const response = await GET(new Request('http://localhost:3000/api/auth/login'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?error=config_missing',
    );
  });

  it('keeps the login state and PKCE verifier in __Host- cookies that only this host can set', async () => {
    process.env.AUTH_COOKIE_SECURE = 'true';
    process.env.OAUTH2_ISSUER = 'https://e.yildizskylab.com/realms/e-skylab';
    process.env.OAUTH2_CLIENT_ID = 'superadmin';
    process.env.OAUTH2_REDIRECT_URI = 'https://admin.yildizskylab.com/api/auth/callback';

    const response = await GET(new Request('https://admin.yildizskylab.com/api/auth/login'));

    const state = new URL(response.headers.get('location')!).searchParams.get('state');
    const transactionCookie = {
      path: '/',
      maxAge: OAUTH_TRANSACTION_MAX_AGE,
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
    };
    const sent = sentCookies(response);
    expect([...sent.keys()].sort()).toEqual(['__Host-oauth_code_verifier', '__Host-oauth_state']);
    expect(sent.get('__Host-oauth_state')).toEqual({ ...transactionCookie, value: state });
    expect(sent.get('__Host-oauth_code_verifier')).toEqual({
      ...transactionCookie,
      value: expect.stringMatching(/^[\w-]{43,128}$/),
    });
  });
});
