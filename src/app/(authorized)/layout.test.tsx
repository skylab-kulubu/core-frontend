/** @jest-environment node */

import { cookies } from 'next/headers';
import AuthorizedLayout from '@/app/(authorized)/layout';
import { fakeCookieStore } from '@/test/server/cookie-store';
import { saveEnv } from '@/test/server/env';
import { accessToken } from '@/test/server/jwt';
import { redirectTarget } from '@/test/server/redirect';

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

jest.mock('next/navigation', () => jest.requireActual('@/test/server/redirect').navigation);

function visit(requestCookies: Record<string, string>) {
  (cookies as jest.Mock).mockResolvedValue(fakeCookieStore(requestCookies).store);
  return redirectTarget(() => AuthorizedLayout({ children: null }));
}

describe('AuthorizedLayout', () => {
  afterEach(saveEnv('AUTH_COOKIE_SECURE'));

  beforeEach(() => {
    process.env.AUTH_COOKIE_SECURE = 'true';
  });

  it('sends an admin whose session is only in a legacy unprefixed cookie to /login', async () => {
    expect(await visit({ auth_token: accessToken() })).toBe('/login');
  });

  it('renders for an admin with a __Host- session cookie', async () => {
    expect(await visit({ '__Host-auth_token': accessToken() })).toBeNull();
  });
});
