'use client';

import { useEffect, useState } from 'react';
import { ticketsApi, type DoorQrUse, type SessionQrMode } from '@/lib/api/tickets';
import { DOOR_QR_FALLBACK_REFRESH_SECONDS, doorQrFailure, svgDataUrl } from '@/lib/door-qr';

/**
 * A door or attendance QR that renews itself every refreshAfterSeconds while `open`. The token
 * and address in it are never logged, stored or sent anywhere else, and a QR that could not be
 * renewed disappears when it expires instead of staying on screen.
 */
export function useRotatingDoorQr(sessionId: string, open: boolean, use: DoorQrUse = 'door') {
  const [src, setSrc] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<SessionQrMode | null>(null);

  useEffect(() => {
    setSrc(null);
    setMessage(null);
    if (!open || !sessionId) return;

    let cancelled = false;
    let nextTimer: ReturnType<typeof setTimeout> | undefined;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    let refreshSeconds = DOOR_QR_FALLBACK_REFRESH_SECONDS;

    const load = async () => {
      clearTimeout(nextTimer);
      if (document.hidden) return;
      try {
        const qr = await ticketsApi.createDoorQr(sessionId, use);
        if (cancelled) return;
        refreshSeconds = qr.refreshAfterSeconds > 0 ? qr.refreshAfterSeconds : refreshSeconds;
        // Time the expiry by the server's own lifetime, so a wrong clock here cannot keep it up.
        const lifetimeMs = Date.parse(qr.expiresAt) - Date.parse(qr.issuedAt);
        clearTimeout(expiryTimer);
        if (Number.isFinite(lifetimeMs) && lifetimeMs > 0) {
          expiryTimer = setTimeout(() => setSrc(null), lifetimeMs);
        }
        setSrc(svgDataUrl(qr.svg));
        setMessage(null);
        if (qr.sessionQrMode) setMode(qr.sessionQrMode);
        nextTimer = setTimeout(load, refreshSeconds * 1000);
      } catch (err) {
        if (cancelled) return;
        const failure = doorQrFailure(err, refreshSeconds);
        setMessage(failure.message);
        if (failure.hideQr) {
          clearTimeout(expiryTimer);
          setSrc(null);
        }
        if (failure.retryAfterSeconds !== null) {
          nextTimer = setTimeout(load, failure.retryAfterSeconds * 1000);
        }
      }
    };

    const onVisible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    void load();

    return () => {
      cancelled = true;
      clearTimeout(nextTimer);
      clearTimeout(expiryTimer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [open, sessionId, use]);

  return { src, message, mode };
}
