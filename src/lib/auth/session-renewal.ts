/**
 * Says when the session's access token was renewed, so what the page read
 * with the old one (the capabilities, the signed-in person's groups) is read
 * again. Roles and groups travel in the token: a membership changed in the
 * panel reaches the person with their next token, at most one token lifetime
 * (five minutes) later, without signing out and in (hub ticket ekip-yetkileri 05).
 */

/** Dispatched on `window` when a request carries a different access token than the one before it. */
export const SESSION_RENEWED_EVENT = 'skylab:session-renewed';

let lastToken: string | null = null;

/** Called with the access token each core request carries (core.ts bearer). */
export function noteAccessToken(token: string | null): void {
  if (!token || typeof window === 'undefined') return;
  const renewed = lastToken !== null && lastToken !== token;
  lastToken = token;
  if (renewed) window.dispatchEvent(new Event(SESSION_RENEWED_EVENT));
}

/** For tests: forget the last token seen. */
export function forgetNotedAccessToken(): void {
  lastToken = null;
}
