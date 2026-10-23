'use client';

import { useEffect, useRef } from 'react';
import { SESSION_RENEWED_EVENT } from '@/lib/auth/session-renewal';

/** A tab shown again reads at most this often; switching windows back and forth stays cheap. */
export const RETURN_REFRESH_MIN_MS = 15_000;

/**
 * Calls `refresh` when the person comes back to the tab (focus, or the tab
 * shown again) and when the session's access token was renewed: the cheap,
 * usual way for a panel to pick up permissions changed while it was open.
 * Returning reads at most every RETURN_REFRESH_MIN_MS, counted from the page
 * load, which has just read; a renewed token always reads.
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
    window.addEventListener('focus', shown);
    document.addEventListener('visibilitychange', shown);
    window.addEventListener(SESSION_RENEWED_EVENT, read);
    return () => {
      window.removeEventListener('focus', shown);
      document.removeEventListener('visibilitychange', shown);
      window.removeEventListener(SESSION_RENEWED_EVENT, read);
    };
  }, [enabled]);
}
