/** @jest-environment node */

import { cookies } from 'next/headers';
import { GET } from '@/app/api/auth/token/route';
import { freezeClock, PAST_THE_LIMIT, secondsLeftAfter, signedInAgo } from '@/test/server/clock';
import {
  EVERY_SECURE_SESSION_COOKIE,
  expiredCookie,
  fakeCookieStore,
  sessionCookie,
} from '@/test/server/cookie-store';
import { saveEnv } from '@/test/server/env';
import { accessToken } from '@/test/server/jwt';

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

/** Stands in for Keycloak's token endpoint on the network boundary. */
function fakeKeycloak(answer: () => Response | Promise<Response>): jest.Mock {
  const tokenEndpoint = jest.fn(async () => answer());
  global.fetch = tokenEndpoint as unknown as typeof fetch;
  return tokenEndpoint;
}

describe('GET /api/auth/token', () => {
  const realFetch = global.fetch;

  afterEach(saveEnv('AUTH_COOKIE_SECURE', 'OAUTH2_ISSUER', 'OAUTH2_CLIENT_ID'));

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env.AUTH_COOKIE_SECURE = 'true';
    process.env.OAUTH2_ISSUER = 'https://e.yildizskylab.com/realms/e-skylab';
    process.env.OAUTH2_CLIENT_ID = 'superadmin';
    freezeClock();
  });

  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('answers 401 without refreshing when only legacy unprefixed session cookies are present', async () => {
    const jar = fakeCookieStore({ auth_token: accessToken(), refresh_token: 'planted-refresh' });
    (cookies as jest.Mock).mockResolvedValue(jar.store);
    const tokenEndpoint = fakeKeycloak(() =>
      Response.json({ access_token: accessToken(), refresh_token: 'refresh-2' }),
    );

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ token: null });
    expect(tokenEndpoint).not.toHaveBeenCalled();
  });

  it('expires the session cookies, current and legacy, when Keycloak rejects the refresh token', async () => {
    const jar = fakeCookieStore({
      '__Host-auth_token': accessToken(-60),
      '__Host-refresh_token': 'revoked-refresh',
      '__Host-session_auth_time': signedInAgo(3600),
      refresh_token: 'old-refresh',
    });
    (cookies as jest.Mock).mockResolvedValue(jar.store);
    fakeKeycloak(() =>
      Response.json(
        { error: 'invalid_grant', error_description: 'Session not active' },
        { status: 400 },
      ),
    );

    const response = await GET();

    expect(response.status).toBe(401);
    expect(jar.sentNames()).toEqual(EVERY_SECURE_SESSION_COOKIE);
    for (const name of jar.sentNames()) {
      expect(jar.sent(name)).toEqual(expiredCookie());
    }
  });

  it('keeps the session cookies when Keycloak is unreachable, since the refresh token may still be valid', async () => {
    const jar = fakeCookieStore({
      '__Host-auth_token': accessToken(-60),
      '__Host-refresh_token': 'refresh-1',
      '__Host-session_auth_time': signedInAgo(3600),
    });
    (cookies as jest.Mock).mockResolvedValue(jar.store);
    fakeKeycloak(() => Promise.reject(new TypeError('fetch failed')));

    const response = await GET();

    expect(response.status).toBe(401);
    expect(jar.sentNames()).toEqual([]);
  });

  it('hands out a live access token of a session signed in less than 8 hours ago', async () => {
    const token = accessToken();
    const jar = fakeCookieStore({
      '__Host-auth_token': token,
      '__Host-refresh_token': 'refresh-1',
      '__Host-session_auth_time': signedInAgo(3600),
    });
    (cookies as jest.Mock).mockResolvedValue(jar.store);
    const tokenEndpoint = fakeKeycloak(() => Response.json({}));

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ token });
    expect(tokenEndpoint).not.toHaveBeenCalled();
    expect(jar.sentNames()).toEqual([]);
  });

  it('refreshes an expired session but keeps it ending 8 hours after the sign-in, not after the refresh', async () => {
    const fresh = accessToken();
    const signedIn = signedInAgo(7 * 3600);
    const jar = fakeCookieStore({
      '__Host-auth_token': accessToken(-60),
      '__Host-refresh_token': 'refresh-1',
      '__Host-session_auth_time': signedIn,
    });
    (cookies as jest.Mock).mockResolvedValue(jar.store);
    fakeKeycloak(() => Response.json({ access_token: fresh, refresh_token: 'refresh-2' }));

    const response = await GET();

    const left = secondsLeftAfter(7 * 3600);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ token: fresh });
    expect(jar.sent('__Host-auth_token')).toEqual(sessionCookie(fresh, left));
    expect(jar.sent('__Host-access_token')).toEqual(sessionCookie(fresh, left));
    expect(jar.sent('__Host-refresh_token')).toEqual(sessionCookie('refresh-2', left));
    expect(jar.sent('__Host-session_auth_time')).toEqual(sessionCookie(signedIn, left));
  });

  it.each([
    ['a live', () => accessToken()],
    ['an expired', () => accessToken(-60)],
  ])(
    'ends a session signed in more than 8 hours ago even with %s access token, without refreshing it',
    async (_name, token) => {
      const jar = fakeCookieStore({
        '__Host-auth_token': token(),
        '__Host-refresh_token': 'refresh-1',
        '__Host-session_auth_time': signedInAgo(PAST_THE_LIMIT),
      });
      (cookies as jest.Mock).mockResolvedValue(jar.store);
      const tokenEndpoint = fakeKeycloak(() =>
        Response.json({ access_token: accessToken(), refresh_token: 'refresh-2' }),
      );

      const response = await GET();

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ token: null });
      expect(tokenEndpoint).not.toHaveBeenCalled();
      expect(jar.sentNames()).toEqual(EVERY_SECURE_SESSION_COOKIE);
      for (const name of jar.sentNames()) {
        expect(jar.sent(name)).toEqual(expiredCookie());
      }
    },
  );

  it('ends a session that has no sign-in time (one started before the 8 hour limit)', async () => {
    const jar = fakeCookieStore({
      '__Host-auth_token': accessToken(),
      '__Host-refresh_token': 'refresh-1',
    });
    (cookies as jest.Mock).mockResolvedValue(jar.store);
    const tokenEndpoint = fakeKeycloak(() => Response.json({}));

    const response = await GET();

    expect(response.status).toBe(401);
    expect(tokenEndpoint).not.toHaveBeenCalled();
    expect(jar.sentNames()).toEqual(EVERY_SECURE_SESSION_COOKIE);
  });
});
