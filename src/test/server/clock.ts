import { AUTH_TIME_CLOCK_SKEW_SECONDS, PANEL_MAX_AUTH_AGE_SECONDS } from '@/lib/auth/auth-age';

/** The fixed "now" of session tests, in epoch seconds (see `freezeClock`). */
export const NOW = 1_800_000_000;

/** Stops the clock at `NOW` for the current test; `jest.restoreAllMocks()` starts it again. */
export function freezeClock(): void {
  jest.spyOn(Date, 'now').mockReturnValue(NOW * 1000);
}

/** The session cookie's sign-in time for a sign-in `secondsAgo` before `NOW`. */
export function signedInAgo(secondsAgo: number): string {
  return String(NOW - secondsAgo);
}

/** Seconds the panel still accepts a sign-in made `secondsAgo` before `NOW`. */
export function secondsLeftAfter(secondsAgo: number): number {
  return PANEL_MAX_AUTH_AGE_SECONDS + AUTH_TIME_CLOCK_SKEW_SECONDS - secondsAgo;
}

/** A sign-in old enough that the panel no longer accepts it. */
export const PAST_THE_LIMIT = PANEL_MAX_AUTH_AGE_SECONDS + AUTH_TIME_CLOCK_SKEW_SECONDS;
