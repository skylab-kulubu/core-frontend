/** @jest-environment node */

import { sessionCookieNames } from '@/lib/auth/session-cookies';
import { saveEnv } from '@/test/server/env';

describe('session cookie names', () => {
  afterEach(saveEnv('AUTH_COOKIE_SECURE'));

  it('carry the __Host- prefix when session cookies are Secure, so no sibling subdomain can plant or shadow them', () => {
    process.env.AUTH_COOKIE_SECURE = 'true';

    expect(sessionCookieNames()).toEqual({
      authToken: '__Host-auth_token',
      accessToken: '__Host-access_token',
      refreshToken: '__Host-refresh_token',
    });
  });

  it('stay plain on local http, where a browser refuses __Host- cookies', () => {
    process.env.AUTH_COOKIE_SECURE = 'false';

    expect(sessionCookieNames()).toEqual({
      authToken: 'auth_token',
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
    });
  });
});
