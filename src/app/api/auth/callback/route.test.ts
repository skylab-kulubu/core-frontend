/** @jest-environment node */

import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/auth/callback/route';
import {
  ACCESS_TOKEN_MAX_AGE,
  expiredCookie,
  fakeCookieStore,
  REFRESH_TOKEN_MAX_AGE,
  sessionCookie,
} from '@/test/server/cookie-store';
import { saveEnv } from '@/test/server/env';

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

/** The login transaction /api/auth/login left behind, under its __Host- names. */
const SIGNING_IN = {
  '__Host-oauth_state': 'state-1',
  '__Host-oauth_code_verifier': 'verifier-1',
};

function callback(query: string) {
  return GET(new NextRequest(`https://admin.yildizskylab.com/api/auth/callback?${query}`));
}

describe('GET /api/auth/callback', () => {
  const realFetch = global.fetch;

  afterEach(
    saveEnv('AUTH_COOKIE_SECURE', 'OAUTH2_ISSUER', 'OAUTH2_CLIENT_ID', 'OAUTH2_REDIRECT_URI'),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env.AUTH_COOKIE_SECURE = 'true';
    process.env.OAUTH2_ISSUER = 'https://e.yildizskylab.com/realms/e-skylab';
    process.env.OAUTH2_CLIENT_ID = 'superadmin';
    process.env.OAUTH2_REDIRECT_URI = 'https://admin.yildizskylab.com/api/auth/callback';
    // Stands in for Keycloak's token endpoint on the network boundary.
    global.fetch = jest.fn(async () =>
      Response.json({ access_token: 'access-1', refresh_token: 'refresh-1' }),
    ) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('keeps the new session in __Host- cookies that only this host can set', async () => {
    const jar = fakeCookieStore(SIGNING_IN);
    (cookies as jest.Mock).mockResolvedValue(jar.store);

    const response = await callback('code=code-1&state=state-1');

    expect(new URL(response.headers.get('location')!).pathname).toBe('/dashboard');
    expect(jar.sent('__Host-auth_token')).toEqual(sessionCookie('access-1', ACCESS_TOKEN_MAX_AGE));
    expect(jar.sent('__Host-access_token')).toEqual(
      sessionCookie('access-1', ACCESS_TOKEN_MAX_AGE),
    );
    expect(jar.sent('__Host-refresh_token')).toEqual(
      sessionCookie('refresh-1', REFRESH_TOKEN_MAX_AGE),
    );
  });

  it('refuses a login whose state and verifier arrive only under the legacy unprefixed names', async () => {
    const jar = fakeCookieStore({ oauth_state: 'planted', oauth_code_verifier: 'planted' });
    (cookies as jest.Mock).mockResolvedValue(jar.store);

    const response = await callback('code=attacker-code&state=planted');

    expect(response.headers.get('location')).toBe(
      'https://admin.yildizskylab.com/login?error=invalid_state',
    );
    expect(global.fetch).not.toHaveBeenCalled();
    expect(jar.sent('__Host-auth_token')).toBeUndefined();
  });

  it('ends the login transaction: expires the __Host- state and verifier, and the legacy ones at their old path', async () => {
    const jar = fakeCookieStore({
      ...SIGNING_IN,
      oauth_state: 'old-state',
      oauth_code_verifier: 'old-verifier',
    });
    (cookies as jest.Mock).mockResolvedValue(jar.store);

    await callback('code=code-1&state=state-1');

    expect(jar.sent('__Host-oauth_state')).toEqual(expiredCookie());
    expect(jar.sent('__Host-oauth_code_verifier')).toEqual(expiredCookie());
    expect(jar.sent('oauth_state')).toEqual(expiredCookie({ path: '/api/auth' }));
    expect(jar.sent('oauth_code_verifier')).toEqual(expiredCookie({ path: '/api/auth' }));
  });

  it('expires the legacy unprefixed session cookies when an admin signs in again', async () => {
    const jar = fakeCookieStore({
      ...SIGNING_IN,
      auth_token: 'old-access',
      refresh_token: 'old-refresh',
    });
    (cookies as jest.Mock).mockResolvedValue(jar.store);

    await callback('code=code-1&state=state-1');

    for (const name of ['auth_token', 'access_token', 'refresh_token', 'token']) {
      expect(jar.sent(name)).toEqual(expiredCookie());
    }
  });

  it('keeps the plain session it just wrote on local http, where the old and new names are the same', async () => {
    process.env.AUTH_COOKIE_SECURE = 'false';
    const jar = fakeCookieStore({ oauth_state: 'state-1', oauth_code_verifier: 'verifier-1' });
    (cookies as jest.Mock).mockResolvedValue(jar.store);

    await callback('code=code-1&state=state-1');

    expect(jar.sent('auth_token')).toEqual(sessionCookie('access-1', ACCESS_TOKEN_MAX_AGE, false));
    expect(jar.sent('access_token')).toEqual(
      sessionCookie('access-1', ACCESS_TOKEN_MAX_AGE, false),
    );
    expect(jar.sent('refresh_token')).toEqual(
      sessionCookie('refresh-1', REFRESH_TOKEN_MAX_AGE, false),
    );
  });
});
