/** @jest-environment node */

import {
  AUTH_TIME_CLOCK_SKEW_SECONDS,
  checkIdToken,
  PANEL_MAX_AUTH_AGE_SECONDS,
  sessionSecondsLeft,
} from '@/lib/auth/auth-age';

const NOW = 1_800_000_000;

function idToken(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${header}.${body}.sig`;
}

describe('the panel sign-in limit', () => {
  it('is 8 hours', () => {
    expect(PANEL_MAX_AUTH_AGE_SECONDS).toBe(28800);
  });

  it('leaves a session that signed in just now the full 8 hours, plus the clock tolerance', () => {
    expect(sessionSecondsLeft(NOW, NOW)).toBe(28800 + AUTH_TIME_CLOCK_SKEW_SECONDS);
  });

  it('counts down from the sign-in, not from the last refresh', () => {
    expect(sessionSecondsLeft(NOW - 3600, NOW)).toBe(25200 + AUTH_TIME_CLOCK_SKEW_SECONDS);
  });

  it('still accepts a sign-in that looks up to a minute older than 8 hours, since the two clocks may differ', () => {
    expect(sessionSecondsLeft(NOW - 28800 - 59, NOW)).toBe(1);
  });

  it('ends a session once its sign-in is 8 hours and a minute old', () => {
    expect(sessionSecondsLeft(NOW - 28800 - 60, NOW)).toBe(0);
    expect(sessionSecondsLeft(NOW - 30 * 24 * 3600, NOW)).toBeLessThan(0);
  });

  it('accepts a sign-in up to a minute in the future, and none further', () => {
    expect(sessionSecondsLeft(NOW + 60, NOW)).toBeGreaterThan(0);
    expect(sessionSecondsLeft(NOW + 61, NOW)).toBe(0);
  });

  it.each([null, undefined, Number.NaN, 0, -5, 1.5])(
    'treats a sign-in time of %p as no session',
    (t) => {
      expect(sessionSecondsLeft(t as number, NOW)).toBe(0);
    },
  );
});

describe('checkIdToken', () => {
  const ISSUER = 'https://e.yildizskylab.com/realms/e-skylab';
  const expected = { issuer: ISSUER, clientId: 'admin' };
  const valid = { iss: ISSUER, aud: 'admin', azp: 'admin', exp: NOW + 300, auth_time: NOW - 60 };

  function check(claims: Record<string, unknown>) {
    return checkIdToken(idToken(claims), expected, NOW);
  }

  it("reads auth_time from the panel's own ID token", () => {
    expect(check(valid)).toEqual({ authTime: NOW - 60 });
    expect(check({ ...valid, aud: ['admin', 'core'] })).toEqual({ authTime: NOW - 60 });
    expect(check({ ...valid, azp: undefined })).toEqual({ authTime: NOW - 60 });
  });

  it('accepts the issuer with or without a trailing slash in the configuration', () => {
    expect(checkIdToken(idToken(valid), { ...expected, issuer: `${ISSUER}/` }, NOW)).toEqual({
      authTime: NOW - 60,
    });
  });

  it('refuses an ID token from another issuer', () => {
    expect(check({ ...valid, iss: 'https://e.yildizskylab.com/realms/e-skylab-sandbox' })).toEqual({
      refused: 'issuer',
    });
    expect(check({ ...valid, iss: undefined })).toEqual({ refused: 'issuer' });
  });

  it('refuses an ID token issued to another client (aud or azp)', () => {
    expect(check({ ...valid, aud: 'other', azp: 'other' })).toEqual({ refused: 'audience' });
    expect(check({ ...valid, aud: undefined })).toEqual({ refused: 'audience' });
    expect(check({ ...valid, azp: 'frontend-main' })).toEqual({ refused: 'audience' });
    // Several audiences: azp must name the panel (OIDC Core 3.1.3.7, items 4 and 5)
    expect(check({ ...valid, aud: ['admin', 'core'], azp: undefined })).toEqual({
      refused: 'audience',
    });
  });

  it('refuses an expired ID token, with the same clock tolerance', () => {
    expect(check({ ...valid, exp: NOW - AUTH_TIME_CLOCK_SKEW_SECONDS - 1 })).toEqual({
      refused: 'expired',
    });
    expect(check({ ...valid, exp: undefined })).toEqual({ refused: 'expired' });
    expect(check({ ...valid, exp: NOW - 30 })).toEqual({ authTime: NOW - 60 });
  });

  it('refuses an ID token without a numeric auth_time', () => {
    expect(check({ ...valid, auth_time: undefined })).toEqual({ refused: 'no_auth_time' });
    expect(check({ ...valid, auth_time: String(NOW) })).toEqual({ refused: 'no_auth_time' });
  });

  it('refuses a sign-in older than the panel accepts', () => {
    expect(
      check({
        ...valid,
        auth_time: NOW - PANEL_MAX_AUTH_AGE_SECONDS - AUTH_TIME_CLOCK_SKEW_SECONDS,
      }),
    ).toEqual({ refused: 'stale' });
  });

  it.each([undefined, '', 'not-a-jwt', 'a.%%%.c'])('refuses %p', (token) => {
    expect(checkIdToken(token, expected, NOW)).toEqual({ refused: 'unreadable' });
  });
});
