'use client';

import { Button } from '@skylab-kulubu/skylcn-ui';
import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { BUTTON_TEXT } from '@/lib/ui/type-scale';

type Detector = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };
type DetectorClass = new (options: { formats: string[] }) => Detector;

function detectorClass(): DetectorClass | null {
  if (typeof window === 'undefined') return null;
  const found = (window as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
  return found ?? null;
}

/**
 * Whether this browser reads QR codes from the camera (BarcodeDetector: Chrome and Edge on
 * Android, desktop Chrome). Elsewhere the door types the code; no library is loaded for it.
 */
export function canScanWithCamera(): boolean {
  return Boolean(
    detectorClass() && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia,
  );
}

/** How long the same code is not read again, so one ticket held up is one entry. */
const REPEAT_MS = 3000;

/**
 * The back camera, reading QR codes until closed; each new code goes to `onScan` once. The
 * camera is let go as soon as the panel closes or the page is left.
 */
export function DoorScanner({
  onScan,
  onClose,
}: {
  onScan: (value: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const scan = useRef(onScan);
  scan.current = onScan;

  useEffect(() => {
    const Klass = detectorClass();
    if (!Klass) {
      setFailed('Bu tarayıcı kameradan kod okuyamıyor.');
      return;
    }
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const last = { value: '', at: 0 };
    const detector = new Klass({ formats: ['qr_code'] });

    const tick = async () => {
      if (stopped || !video.current) return;
      try {
        const codes = await detector.detect(video.current);
        const value = codes[0]?.rawValue?.trim();
        const now = Date.now();
        if (value && (value !== last.value || now - last.at > REPEAT_MS)) {
          last.value = value;
          last.at = now;
          scan.current(value);
        }
      } catch {
        // A frame that could not be read: the next one is tried
      }
      timer = setTimeout(() => void tick(), 250);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(async (media) => {
        if (stopped) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = media;
        if (video.current) {
          video.current.srcObject = media;
          await video.current.play().catch(() => undefined);
        }
        void tick();
      })
      .catch(() => setFailed('Kamera açılamadı. İzin verip tekrar dene.'));

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <section aria-label="Kamerayla tara" className="space-y-2">
      <div className="relative overflow-hidden rounded-lg bg-black">
        <video
          ref={video}
          muted
          playsInline
          aria-label="Kamera görüntüsü"
          className="aspect-square w-full object-cover sm:aspect-video"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[18%] rounded-xl border-2 border-white/80"
        />
      </div>
      {failed ? (
        <p role="alert" className="text-destructive text-sm">
          {failed}
        </p>
      ) : null}
      <Button variant="outline" size="lg" className={`${BUTTON_TEXT} w-full`} onClick={onClose}>
        <X aria-hidden />
        Kamerayı kapat
      </Button>
    </section>
  );
}
