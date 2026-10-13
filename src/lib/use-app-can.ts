'use client';

import { useEffect, useState } from 'react';
import { capabilitiesApi } from '@/lib/api/capabilities';

/**
 * core's answer to "may I" for a decision that names no Owner team
 * (GET /v1/users/me/capabilities `can`), so a page shows only the buttons
 * whose requests core would take: a DK member reads and sees no write button.
 * Until the answer arrives every key is `false`; when it cannot be read,
 * `fallback` (the page's group rule) stands in, since core still decides
 * every request.
 */
export function useAppCan(fallback: boolean): (key: string) => boolean {
  const [can, setCan] = useState<Record<string, boolean> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    capabilitiesApi
      .get()
      .then((answer) => {
        if (!cancelled) setCan(answer?.can ?? {});
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (key) => (failed ? fallback : Boolean(can?.[key]));
}
