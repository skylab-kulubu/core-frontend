'use client';

import { useState } from 'react';
import { SaveButton } from '@/components/chrome/SaveButton';
import { useRotatingDoorQr } from '@/components/scheduling/useRotatingDoorQr';

/**
 * The door's guest QR: a fresh one every refreshAfterSeconds, shown big for guests to scan.
 * The token and address in it are never logged, stored or sent anywhere else, and a QR that
 * could not be renewed disappears when it expires instead of staying on screen.
 */
export function GuestDoorQr({
  sessionId,
  open: shown,
}: {
  sessionId: string;
  /** Opened from outside (the door's command row): no button of its own. */
  open?: boolean;
}) {
  const [own, setOpen] = useState(false);
  const controlled = shown !== undefined;
  const open = controlled ? shown : own;
  const { src, message } = useRotatingDoorQr(sessionId, open);

  return (
    <section aria-label="Misafir QR'ı" className="space-y-3">
      {controlled ? null : (
        <SaveButton type="button" disabled={!sessionId} onClick={() => setOpen((value) => !value)}>
          {open ? 'Misafir QR’ını gizle' : 'Misafir QR’ını göster'}
        </SaveButton>
      )}
      {open ? (
        <div className="space-y-2">
          {src ? (
            <img
              src={src}
              alt="Misafir girişi için kapı QR'ı"
              className="mx-auto aspect-square w-80 max-w-full rounded-md bg-white"
            />
          ) : null}
          {message ? (
            <p role="status" className="text-secondary-foreground text-sm">
              {message}
            </p>
          ) : null}
          {src ? (
            <p className="text-secondary-foreground text-sm">QR kendiliğinden yenilenir.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
