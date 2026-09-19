/** @jest-environment node */

import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/logout/route';
import { authCookieSecure } from '@/lib/auth/cookie-secure';

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

jest.mock('@/lib/auth/cookie-secure', () => ({
  authCookieSecure: jest.fn(),
}));

describe('OAuth logout route', () => {
  const deleteCookie = jest.fn();
  const setCookie = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (cookies as jest.Mock).mockResolvedValue({
      delete: deleteCookie,
      set: setCookie,
    });
    (authCookieSecure as jest.Mock).mockReturnValue(true);
  });

  it('expires every cookie that can authenticate an admin session', async () => {
    const response = await POST(new NextRequest('https://admin.yildizskylab.com/api/auth/logout'));

    expect(response.status).toBe(200);
    for (const name of ['auth_token', 'access_token', 'refresh_token', 'token']) {
      expect(deleteCookie).toHaveBeenCalledWith(name);
      expect(setCookie).toHaveBeenCalledWith(
        name,
        '',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 0,
          path: '/',
        }),
      );
    }
  });
});
