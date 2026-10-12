/** @jest-environment node */

import { cookies } from 'next/headers';
import AuthorizedLayout from '@/app/(authorized)/layout';
import { fakeCookieStore } from '@/test/server/cookie-store';
import { freezeClock, PAST_THE_LIMIT, signedInAgo } from '@/test/server/clock';
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
    freezeClock();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends an admin whose session is only in a legacy unprefixed cookie to /login', async () => {
    expect(await visit({ auth_token: accessToken() })).toBe('/login');
  });

  it('renders for an admin with a __Host- session cookie', async () => {
    expect(
      await visit({
        '__Host-auth_token': accessToken(),
        '__Host-session_auth_time': signedInAgo(3600),
      }),
    ).toBeNull();
  });

  it.each([
    ['more than 8 hours ago', { '__Host-session_auth_time': signedInAgo(PAST_THE_LIMIT) }],
    ['at an unknown time', {}],
  ])('sends an admin who signed in %s to /login', async (_name, signIn) => {
    expect(
      await visit({ '__Host-auth_token': accessToken(), '__Host-refresh_token': 'r', ...signIn }),
    ).toBe('/login');
  });
});
