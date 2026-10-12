/** @jest-environment node */

import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/auth/callback/route';
import { freezeClock, NOW, PAST_THE_LIMIT, secondsLeftAfter } from '@/test/server/clock';
import { expiredCookie, fakeCookieStore, sessionCookie } from '@/test/server/cookie-store';
import { saveEnv } from '@/test/server/env';
import { idToken } from '@/test/server/jwt';

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

/** The login transaction /api/auth/login left behind, under its __Host- names. */
const SIGNING_IN = {
  '__Host-oauth_state': 'state-1',
  '__Host-oauth_code_verifier': 'verifier-1',
};

/** The admin signed in at Keycloak ten minutes ago (an SSO session Keycloak reused). */
const SIGNED_IN_SECONDS_AGO = 600;
const SESSION_SECONDS_LEFT = secondsLeftAfter(SIGNED_IN_SECONDS_AGO);

/**
 * Stands in for Keycloak's token endpoint on the network boundary: its ID token is the panel's,
 * signed in ten minutes ago, with `idTokenClaims` changed; `null` leaves the ID token out.
 */
function fakeKeycloak(idTokenClaims: Record<string, unknown> | null = {}) {
  global.fetch = jest.fn(async () =>
    Response.json({
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      ...(idTokenClaims && { id_token: idToken(NOW - SIGNED_IN_SECONDS_AGO, idTokenClaims) }),
    }),
  ) as typeof fetch;
}

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
    freezeClock();
    fakeKeycloak();
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
    expect(jar.sent('__Host-auth_token')).toEqual(sessionCookie('access-1', SESSION_SECONDS_LEFT));
    expect(jar.sent('__Host-access_token')).toEqual(
      sessionCookie('access-1', SESSION_SECONDS_LEFT),
    );
    expect(jar.sent('__Host-refresh_token')).toEqual(
      sessionCookie('refresh-1', SESSION_SECONDS_LEFT),
    );
  });

  it("keeps the ID token's sign-in time, so the session ends 8 hours after the sign-in at Keycloak", async () => {
    const jar = fakeCookieStore(SIGNING_IN);
    (cookies as jest.Mock).mockResolvedValue(jar.store);

    await callback('code=code-1&state=state-1');

    expect(jar.sent('__Host-session_auth_time')).toEqual(
      sessionCookie(String(NOW - SIGNED_IN_SECONDS_AGO), SESSION_SECONDS_LEFT),
    );
  });

  it.each([
    ['carries no auth_time', { auth_time: undefined }],
    ['carries a sign-in older than 8 hours', { auth_time: NOW - PAST_THE_LIMIT }],
    ['was issued to another client', { aud: 'frontend-main', azp: 'frontend-main' }],
    ['names another client as its azp', { azp: 'frontend-main' }],
    ['comes from another issuer', { iss: 'https://e.yildizskylab.com/realms/e-skylab-sandbox' }],
    ['has expired', { exp: NOW - 3600 }],
  ])('refuses the login and starts no session when the ID token %s', async (_name, claims) => {
    fakeKeycloak(claims);
    const jar = fakeCookieStore(SIGNING_IN);
    (cookies as jest.Mock).mockResolvedValue(jar.store);

    const response = await callback('code=code-1&state=state-1');

    expect(response.headers.get('location')).toBe(
      'https://admin.yildizskylab.com/login?error=stale_authentication',
    );
    expect(jar.sent('__Host-auth_token')).toBeUndefined();
    expect(jar.sent('__Host-refresh_token')).toBeUndefined();
    expect(jar.sent('__Host-session_auth_time')).toBeUndefined();
  });

  it('refuses the login when Keycloak returns no ID token', async () => {
    fakeKeycloak(null);
    const jar = fakeCookieStore(SIGNING_IN);
    (cookies as jest.Mock).mockResolvedValue(jar.store);

    const response = await callback('code=code-1&state=state-1');

    expect(response.headers.get('location')).toBe(
      'https://admin.yildizskylab.com/login?error=stale_authentication',
    );
    expect(jar.sent('__Host-auth_token')).toBeUndefined();
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

    expect(jar.sent('auth_token')).toEqual(sessionCookie('access-1', SESSION_SECONDS_LEFT, false));
    expect(jar.sent('access_token')).toEqual(
      sessionCookie('access-1', SESSION_SECONDS_LEFT, false),
    );
    expect(jar.sent('refresh_token')).toEqual(
      sessionCookie('refresh-1', SESSION_SECONDS_LEFT, false),
    );
    expect(jar.sent('session_auth_time')).toEqual(
      sessionCookie(String(NOW - SIGNED_IN_SECONDS_AGO), SESSION_SECONDS_LEFT, false),
    );
  });
});
