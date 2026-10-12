'use client';

import { useEffect } from 'react';

/** How often an open page checks whether its session has run out. */
export const SESSION_DEADLINE_CHECK_MS = 15_000;

function signInAgain(): void {
  // /login sends the admin straight on to Keycloak, which asks for a new sign-in (max_age).
  window.location.assign('/login');
}

/**
 * Leaves the page for the login once the session's sign-in is older than the panel accepts
 * (`auth-age.ts`). `secondsLeft` comes from the server when the page loads; counting from the
 * browser's own clock at that moment keeps a wrong browser clock out of it. A long timer would fire
 * late after the computer sleeps, so the page checks every few seconds and whenever it is shown.
 */
export function useSessionDeadline(
  secondsLeft: number | undefined,
  expire: () => void = signInAgain,
): void {
  useEffect(() => {
    if (secondsLeft == null) return;
    const deadline = Date.now() + secondsLeft * 1000;
    let expired = false;
    const check = () => {
      if (expired || Date.now() < deadline) return;
      expired = true;
      expire();
    };

    check();
    const interval = window.setInterval(check, SESSION_DEADLINE_CHECK_MS);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [secondsLeft, expire]);
}
