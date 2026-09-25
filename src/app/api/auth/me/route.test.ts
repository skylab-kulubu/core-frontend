/** @jest-environment node */

import { cookies } from 'next/headers';
import { GET } from '@/app/api/auth/me/route';
import {
  EVERY_SECURE_SESSION_COOKIE,
  expiredCookie,
  fakeCookieStore,
} from '@/test/server/cookie-store';
import { saveEnv } from '@/test/server/env';
import { accessToken, accessTokenWithoutUser } from '@/test/server/jwt';

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

/** Stands in for Keycloak's token endpoint on the network boundary. */
function fakeKeycloak(answer: () => Response | Promise<Response>) {
  global.fetch = jest.fn(async () => answer()) as typeof fetch;
}

describe('GET /api/auth/me', () => {
  const realFetch = global.fetch;

  afterEach(saveEnv('AUTH_COOKIE_SECURE', 'OAUTH2_ISSUER', 'OAUTH2_CLIENT_ID'));

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env.AUTH_COOKIE_SECURE = 'true';
    process.env.OAUTH2_ISSUER = 'https://e.yildizskylab.com/realms/e-skylab';
    process.env.OAUTH2_CLIENT_ID = 'superadmin';
  });

  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('expires the session cookies, current and legacy, when Keycloak rejects the refresh token', async () => {
    const jar = fakeCookieStore({
      '__Host-auth_token': accessToken(-60),
      '__Host-refresh_token': 'revoked-refresh',
      auth_token: 'old-access',
    });
    (cookies as jest.Mock).mockResolvedValue(jar.store);
    fakeKeycloak(() =>
      Response.json(
        { error: 'invalid_grant', error_description: 'Token is not active' },
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

  it.each([
    ['is unreachable', () => Promise.reject(new TypeError('fetch failed'))],
    ['answers 502', () => new Response('<html>Bad gateway</html>', { status: 502 })],
  ])(
    'keeps the session cookies when Keycloak %s, since the refresh token may still be valid',
    async (_name, keycloakAnswer) => {
      const jar = fakeCookieStore({
        '__Host-auth_token': accessToken(-60),
        '__Host-refresh_token': 'refresh-1',
      });
      (cookies as jest.Mock).mockResolvedValue(jar.store);
      fakeKeycloak(keycloakAnswer as () => Promise<Response>);

      const response = await GET();

      expect(response.status).toBe(401);
      expect(jar.sentNames()).toEqual([]);
    },
  );

  it('expires the session cookies, current and legacy, when the session names no user', async () => {
    const jar = fakeCookieStore({
      '__Host-auth_token': accessTokenWithoutUser(),
      '__Host-refresh_token': 'refresh-1',
      auth_token: 'old-access',
      refresh_token: 'old-refresh',
    });
    (cookies as jest.Mock).mockResolvedValue(jar.store);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(jar.sentNames()).toEqual(EVERY_SECURE_SESSION_COOKIE);
    // A __Host- cookie is only replaced by a Set-Cookie that is itself Secure with Path=/.
    for (const name of jar.sentNames()) {
      expect(jar.sent(name)).toEqual(expiredCookie());
    }
  });
});
