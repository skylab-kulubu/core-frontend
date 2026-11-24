'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@skylab-kulubu/skylcn-ui';
import { SaveButton } from '@/components/chrome/SaveButton';
import { useRotatingDoorQr } from '@/components/scheduling/useRotatingDoorQr';
import type { SessionQrMode } from '@/lib/api/tickets';

/**
 * The session's attendance QR for the projector or OBS: core's display token (a whole room
 * scans one frame), renewed every refreshAfterSeconds, full screen on demand. Reports core's
 * SESSION_QR_MODE so the page can drop the printed QR once it no longer checks anyone in.
 */
export function AttendanceQr({
  sessionId,
  title,
  onMode,
}: {
  sessionId: string;
  title: string;
  onMode?: (mode: SessionQrMode) => void;
}) {
  const { src, message, mode } = useRotatingDoorQr(sessionId, true, 'display');
  const screenRef = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (mode) onMode?.(mode);
  }, [mode, onMode]);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === screenRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  return (
    <section aria-label="Yoklama QR'ı" className="space-y-3">
      <div
        ref={screenRef}
        className={cn(
          full
            ? 'flex h-full w-full cursor-none flex-col items-center justify-center gap-6 bg-black text-white'
            : 'space-y-2',
        )}
      >
        {full ? <p className="text-4xl font-semibold">{title}</p> : null}
        {src ? (
          <img
            src={src}
            alt="Oturum yoklaması için QR"
            className={cn(
              'aspect-square rounded-md bg-white',
              full ? 'h-[70vh] max-w-[90vw]' : 'mx-auto w-80 max-w-full',
            )}
          />
        ) : null}
        {full ? <p className="text-2xl">Yoklama için telefonunun kamerasıyla okut</p> : null}
      </div>
      {message ? (
        <p role="status" className="text-secondary-foreground text-sm">
          {message}
        </p>
      ) : null}
      {src ? (
        <>
          <p className="text-secondary-foreground text-sm">
            Kendiliğinden yenilenir. Salondaki ekrana ver, canlı yayına koyma.
          </p>
          <SaveButton type="button" onClick={() => void screenRef.current?.requestFullscreen?.()}>
            Tam ekran
          </SaveButton>
        </>
      ) : null}
    </section>
  );
}
