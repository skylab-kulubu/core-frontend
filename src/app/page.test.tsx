/** @jest-environment node */

import { cookies } from 'next/headers';
import RootPage from '@/app/page';
import { fakeCookieStore } from '@/test/server/cookie-store';
import { saveEnv } from '@/test/server/env';
import { redirectTarget } from '@/test/server/redirect';

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

jest.mock('next/navigation', () => jest.requireActual('@/test/server/redirect').navigation);

function visit(requestCookies: Record<string, string>) {
  (cookies as jest.Mock).mockResolvedValue(fakeCookieStore(requestCookies).store);
  return redirectTarget(() => RootPage());
}

describe('RootPage', () => {
  afterEach(saveEnv('AUTH_COOKIE_SECURE'));

  beforeEach(() => {
    process.env.AUTH_COOKIE_SECURE = 'true';
  });

  it('sends an admin whose session is only in legacy unprefixed cookies to /login', async () => {
    expect(await visit({ auth_token: 'old-access', refresh_token: 'old-refresh' })).toBe('/login');
  });

  it('sends an admin with a __Host- refresh cookie on to the dashboard', async () => {
    expect(await visit({ '__Host-refresh_token': 'refresh-1' })).toBe('/dashboard');
  });
});
