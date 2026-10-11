'use client';

import { useEffect, useState } from 'react';
import { SaveButton } from '@/components/chrome/SaveButton';
import { ticketsApi } from '@/lib/api/tickets';
import { DOOR_QR_FALLBACK_REFRESH_SECONDS, doorQrFailure, svgDataUrl } from '@/lib/door-qr';

/**
 * The door's guest QR: a fresh one every refreshAfterSeconds, shown big for guests to scan.
 * The token and address in it are never logged, stored or sent anywhere else, and a QR that
 * could not be renewed disappears when it expires instead of staying on screen.
 */
export function GuestDoorQr({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
        const qr = await ticketsApi.createDoorQr(sessionId);
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
  }, [open, sessionId]);

  return (
    <section aria-label="Misafir QR'ı" className="space-y-3">
      <SaveButton type="button" disabled={!sessionId} onClick={() => setOpen((value) => !value)}>
        {open ? 'Misafir QR’ını gizle' : 'Misafir QR’ını göster'}
      </SaveButton>
      {open ? (
        <div className="space-y-2">
          {src ? (
            <img
              src={src}
              alt="Misafir girişi için kapı QR'ı"
              className="h-80 w-80 max-w-full rounded-md bg-white"
            />
          ) : null}
          {message ? (
            <p role="status" className="text-secondary-foreground text-sm">
              {message}
            </p>
          ) : null}
          {src ? (
            <p className="text-secondary-foreground text-sm">
              Misafirler bu QR’ı telefon kamerasıyla okutur; QR kısa sürede kendiliğinden yenilenir.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
