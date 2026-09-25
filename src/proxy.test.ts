/** @jest-environment node */

import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { saveEnv } from '@/test/server/env';

function visit(path: string, cookie: string) {
  return proxy(new NextRequest(`https://admin.yildizskylab.com${path}`, { headers: { cookie } }));
}

function sentToLogin(response: Response): boolean {
  const location = response.headers.get('location');
  return location !== null && new URL(location).pathname === '/login';
}

describe('proxy', () => {
  afterEach(saveEnv('AUTH_COOKIE_SECURE'));

  beforeEach(() => {
    process.env.AUTH_COOKIE_SECURE = 'true';
  });

  it('lets an admin with a __Host- session cookie through', () => {
    expect(sentToLogin(visit('/dashboard', '__Host-auth_token=access-1'))).toBe(false);
  });

  it.each(['auth_token', 'access_token', 'token'])(
    'sends a request carrying only a legacy %s cookie to /login, since a sibling subdomain could have planted it',
    (legacyName) => {
      expect(sentToLogin(visit('/dashboard', `${legacyName}=planted`))).toBe(true);
    },
  );
});
