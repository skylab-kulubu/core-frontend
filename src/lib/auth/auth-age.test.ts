/** @jest-environment node */

import {
  AUTH_TIME_CLOCK_SKEW_SECONDS,
  idTokenAuthTime,
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

describe('idTokenAuthTime', () => {
  it("reads auth_time from the panel's own ID token", () => {
    expect(idTokenAuthTime(idToken({ aud: 'admin', auth_time: NOW }), 'admin')).toBe(NOW);
    expect(idTokenAuthTime(idToken({ aud: ['admin', 'x'], auth_time: NOW }), 'admin')).toBe(NOW);
  });

  it('refuses an ID token issued to another client', () => {
    expect(idTokenAuthTime(idToken({ aud: 'other', auth_time: NOW }), 'admin')).toBeNull();
    expect(idTokenAuthTime(idToken({ auth_time: NOW }), 'admin')).toBeNull();
  });

  it('refuses an ID token without a numeric auth_time', () => {
    expect(idTokenAuthTime(idToken({ aud: 'admin' }), 'admin')).toBeNull();
    expect(idTokenAuthTime(idToken({ aud: 'admin', auth_time: String(NOW) }), 'admin')).toBeNull();
  });

  it.each([undefined, '', 'not-a-jwt', 'a.%%%.c'])('refuses %p', (token) => {
    expect(idTokenAuthTime(token, 'admin')).toBeNull();
  });
});
