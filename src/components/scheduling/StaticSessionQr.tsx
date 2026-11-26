'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, cn } from '@skylab-kulubu/skylcn-ui';
import { SaveButton } from '@/components/chrome/SaveButton';
import { sessionQrFileName } from '@/lib/api/sessions';
import { ticketsApi, type DoorQr } from '@/lib/api/tickets';
import { staticQrFailure, staticQrWindowText, svgDataUrl } from '@/lib/door-qr';
import { qrPngBlob, saveBlob } from '@/lib/qr-png';
import { BUTTON_TEXT } from '@/lib/ui/type-scale';

/** A static QR and the session it belongs to. */
type Shown = { qr: DoorQr; sessionId: string; title: string };

/**
 * The session's static attendance QR, the fallback when no screen can show the rotating one: the
 * same QR every time, read with a phone's camera, valid in the session window. Fetched only once
 * asked for, full screen or saved as a PNG for printing. Once shown it follows `sessionId`: a new
 * session's QR replaces the old in place, full screen included, so it can follow the screen's
 * session; the title shown is always that of the QR's own session.
 */
export function StaticSessionQr({ sessionId, title }: { sessionId: string; title: string }) {
  const [wanted, setWanted] = useState(false);
  const [shown, setShown] = useState<Shown | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef(title);
  titleRef.current = title;

  useEffect(() => {
    if (!wanted) {
      setShown(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    ticketsApi
      .createDoorQr(sessionId, 'static')
      .then((qr) => {
        if (cancelled) return;
        setShown({ qr, sessionId, title: titleRef.current });
        setMessage(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setShown(null);
        setWanted(false);
        setMessage(staticQrFailure(err));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [wanted, sessionId]);

  useEffect(() => {
    // Before the QR is shown the ref is null, as is fullscreenElement once another screen
    // leaves full screen: that is not this one going full screen.
    const onChange = () => {
      const screen = screenRef.current;
      setFull(screen !== null && document.fullscreenElement === screen);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const download = async () => {
    if (!shown) return;
    try {
      saveBlob(
        await qrPngBlob(shown.qr.svg, shown.title),
        sessionQrFileName(shown.sessionId, `${shown.title} sabit`),
      );
    } catch {
      setMessage('PNG hazırlanamadı.');
    }
  };

  const validity = shown ? staticQrWindowText(shown.qr.validFrom, shown.qr.validUntil) : '';

  return (
    <section aria-label="Sabit QR" className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Sabit QR (yazdır/ekran)</h3>
        <p className="text-secondary-foreground text-sm">
          Dönen QR gösterilemezse: oturumun tek, değişmeyen QR&apos;ı. Telefon kamerasıyla okunur.
        </p>
        <p className="text-sm">Oturum: {shown?.title ?? title}</p>
      </div>
      {shown ? (
        <>
          <div
            ref={screenRef}
            className={cn(
              full
                ? 'flex h-full w-full cursor-none flex-col items-center justify-center gap-6 bg-black text-white'
                : 'space-y-2',
            )}
          >
            {full ? <p className="text-4xl font-semibold">{shown.title}</p> : null}
            <img
              src={svgDataUrl(shown.qr.svg)}
              alt="Oturumun sabit yoklama QR'ı"
              className={cn(
                'aspect-square rounded-md bg-white',
                full ? 'h-[70vh] max-w-[90vw]' : 'mx-auto w-80 max-w-full',
              )}
            />
            {full ? <p className="text-2xl">Yoklama için telefonunun kamerasıyla okut</p> : null}
          </div>
          {validity ? <p className="text-secondary-foreground text-sm">{validity}</p> : null}
          <p className="text-secondary-foreground text-sm">
            Fotoğrafı paylaşılırsa salonda olmayan da bu sürede okutabilir. Canlı yayına koyma.
          </p>
          <div className="flex flex-wrap gap-2">
            <SaveButton type="button" onClick={() => void screenRef.current?.requestFullscreen?.()}>
              Tam ekran
            </SaveButton>
            <Button
              type="button"
              variant="outline"
              className={BUTTON_TEXT}
              onClick={() => void download()}
            >
              PNG indir
            </Button>
          </div>
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          className={BUTTON_TEXT}
          disabled={busy}
          onClick={() => setWanted(true)}
        >
          {busy ? 'Hazırlanıyor…' : 'Sabit QR’ı göster'}
        </Button>
      )}
      {message ? (
        <p role="status" className="text-secondary-foreground text-sm">
          {message}
        </p>
      ) : null}
    </section>
  );
}
