'use client';

import { useEffect, useRef } from 'react';
import { SESSION_RENEWED_EVENT } from '@/lib/auth/session-renewal';

/** A tab shown again reads at most this often; switching windows back and forth stays cheap. */
export const RETURN_REFRESH_MIN_MS = 15_000;

/** A tab left open and shown reads again this long after its last read (one access token lifetime). */
export const OPEN_REFRESH_INTERVAL_MS = 5 * 60_000;

/** How often an open tab checks whether OPEN_REFRESH_INTERVAL_MS has passed. */
const OPEN_REFRESH_TICK_MS = 60_000;

/**
 * Calls `refresh` when the person comes back to the tab (focus, or the tab
 * shown again) and when the session's access token was renewed: the cheap,
 * usual way for a panel to pick up permissions changed while it was open.
 * Returning reads at most every RETURN_REFRESH_MIN_MS, counted from the page
 * load, which has just read; a renewed token always reads. A tab that stays
 * shown also reads OPEN_REFRESH_INTERVAL_MS after its last read, so a panel
 * left open without requests still catches up; a hidden tab never does.
 */
export function useRefreshOnReturn(refresh: () => void, enabled = true): void {
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  });

  useEffect(() => {
    if (!enabled) return;
    let readAt = Date.now();
    const read = () => {
      readAt = Date.now();
      latest.current();
    };
    const shown = () => {
      if (document.visibilityState === 'hidden') return;
      if (Date.now() - readAt < RETURN_REFRESH_MIN_MS) return;
      read();
    };
    const tick = () => {
      if (document.visibilityState === 'hidden') return;
      if (Date.now() - readAt < OPEN_REFRESH_INTERVAL_MS) return;
      read();
    };
    window.addEventListener('focus', shown);
    document.addEventListener('visibilitychange', shown);
    window.addEventListener(SESSION_RENEWED_EVENT, read);
    const timer = window.setInterval(tick, OPEN_REFRESH_TICK_MS);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', shown);
      document.removeEventListener('visibilitychange', shown);
      window.removeEventListener(SESSION_RENEWED_EVENT, read);
    };
  }, [enabled]);
}
