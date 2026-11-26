'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, cn } from '@skylab-kulubu/skylcn-ui';
import { SaveButton } from '@/components/chrome/SaveButton';
import { sessionQrFileName } from '@/lib/api/sessions';
import { ticketsApi, type DoorQr } from '@/lib/api/tickets';
import { staticQrFailure, staticQrWindowText, svgDataUrl } from '@/lib/door-qr';
import { qrPngBlob, saveBlob } from '@/lib/qr-png';
import { BUTTON_TEXT } from '@/lib/ui/type-scale';

/**
 * The session's static attendance QR, the fallback when no screen can show the rotating one: the
 * same QR every time, read with a phone's camera, valid in the session window. Shown only when
 * asked for, full screen or saved as a PNG for printing.
 */
export function StaticSessionQr({ sessionId, title }: { sessionId: string; title: string }) {
  const [qr, setQr] = useState<DoorQr | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQr(null);
    setMessage(null);
  }, [sessionId]);

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

  const show = async () => {
    setBusy(true);
    try {
      setQr(await ticketsApi.createDoorQr(sessionId, 'static'));
      setMessage(null);
    } catch (err) {
      setMessage(staticQrFailure(err));
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (!qr) return;
    try {
      saveBlob(await qrPngBlob(qr.svg, title), sessionQrFileName(sessionId, `${title} sabit`));
    } catch {
      setMessage('PNG hazırlanamadı.');
    }
  };

  const validity = qr ? staticQrWindowText(qr.validFrom, qr.validUntil) : '';

  return (
    <section aria-label="Sabit QR" className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Sabit QR (yazdır/ekran)</h3>
        <p className="text-secondary-foreground text-sm">
          Dönen QR gösterilemezse: oturumun tek, değişmeyen QR&apos;ı. Telefon kamerasıyla okunur.
        </p>
      </div>
      {qr ? (
        <>
          <div
            ref={screenRef}
            className={cn(
              full
                ? 'flex h-full w-full cursor-none flex-col items-center justify-center gap-6 bg-black text-white'
                : 'space-y-2',
            )}
          >
            {full ? <p className="text-4xl font-semibold">{title}</p> : null}
            <img
              src={svgDataUrl(qr.svg)}
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
          onClick={() => void show()}
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
