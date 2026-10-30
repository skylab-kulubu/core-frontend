/** @jest-environment node */

import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { freezeClock, PAST_THE_LIMIT, signedInAgo } from '@/test/server/clock';
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
    freezeClock();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lets an admin with a __Host- session cookie through', () => {
    const cookie = `__Host-auth_token=access-1; __Host-session_auth_time=${signedInAgo(3600)}`;
    expect(sentToLogin(visit('/dashboard', cookie))).toBe(false);
  });

  it('sends an admin whose sign-in is more than 8 hours old to /login', () => {
    const cookie = `__Host-auth_token=access-1; __Host-session_auth_time=${signedInAgo(PAST_THE_LIMIT)}`;
    expect(sentToLogin(visit('/dashboard', cookie))).toBe(true);
  });

  it('sends an admin whose session has no sign-in time (one from before the limit) to /login', () => {
    expect(sentToLogin(visit('/dashboard', '__Host-auth_token=access-1'))).toBe(true);
  });

  it.each(['auth_token', 'access_token', 'token'])(
    'sends a request carrying only a legacy %s cookie to /login, since a sibling subdomain could have planted it',
    (legacyName) => {
      expect(sentToLogin(visit('/dashboard', `${legacyName}=planted`))).toBe(true);
    },
  );

  it('lets the health check through without a session, so the container probe gets 200', () => {
    expect(sentToLogin(visit('/api/health', ''))).toBe(false);
  });

  it.each(['/api/healthz', '/api/health/x'])(
    'still sends %s without a session to /login',
    (path) => {
      expect(sentToLogin(visit(path, ''))).toBe(true);
    },
  );

  describe('under next dev', () => {
    afterEach(saveEnv('NODE_ENV'));

    beforeEach(() => {
      Object.assign(process.env, { NODE_ENV: 'development' });
    });

    it('lets a request for the dev server sandbox API proxy through without a session, so core answers it', () => {
      expect(sentToLogin(visit('/sandbox-api/v1/dashboard/github-activity', ''))).toBe(false);
    });

    it.each(['/dashboard', '/sandbox-api', '/sandbox-apis/v1/events'])(
      'still sends %s without a session to /login',
      (path) => {
        expect(sentToLogin(visit(path, ''))).toBe(true);
      },
    );
  });

  describe('in the image', () => {
    afterEach(saveEnv('NODE_ENV'));

    beforeEach(() => {
      Object.assign(process.env, { NODE_ENV: 'production' });
    });

    it('sends /sandbox-api/ without a session to /login like any other path, since nothing forwards it there', () => {
      expect(sentToLogin(visit('/sandbox-api/v1/dashboard/github-activity', ''))).toBe(true);
    });
  });
});
