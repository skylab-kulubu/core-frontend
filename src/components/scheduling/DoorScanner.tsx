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
 * Whether this browser can read QR codes from the camera. BarcodeDetector (Chrome and Edge on
 * Android, desktop Chrome) reads them natively; elsewhere (Safari on iPhone, Firefox) a small
 * reader that decodes in a Web Worker is loaded when the camera is opened. A camera needs a
 * secure page: on plain http `navigator.mediaDevices` is missing and the door types the code.
 */
export function canScanWithCamera(): boolean {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false;
  return Boolean(detectorClass() || typeof Worker !== 'undefined');
}

/** One QR reader over the camera's video: the text of a code in view, or null. */
type QrReader = { read: (video: HTMLVideoElement) => Promise<string | null>; close: () => void };

/**
 * The browser's own BarcodeDetector when there is one; otherwise qr-scanner, loaded only now
 * (nothing of it is in the page until the camera is opened) and decoding off the main thread.
 */
export async function openQrReader(): Promise<QrReader> {
  const Native = detectorClass();
  if (Native) {
    const detector = new Native({ formats: ['qr_code'] });
    return {
      read: async (video) => (await detector.detect(video))[0]?.rawValue ?? null,
      close: () => undefined,
    };
  }
  const { default: QrScanner } = await import('qr-scanner');
  const engine = await QrScanner.createQrEngine();
  const canvas = document.createElement('canvas');
  return {
    read: async (video) => {
      // No frame yet (Safari starts the stream a moment after play)
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
      try {
        const result = await QrScanner.scanImage(video, {
          qrEngine: engine,
          canvas,
          returnDetailedScanResult: true,
        });
        return result.data;
      } catch (error) {
        if (String(error).includes(QrScanner.NO_QR_CODE_FOUND)) return null;
        throw error;
      }
    },
    close: () => {
      if (typeof Worker !== 'undefined' && engine instanceof Worker) engine.terminate();
    },
  };
}

/** How long the same code is not read again, so one ticket held up is one entry. */
const REPEAT_MS = 3000;

function cameraFailure(error: unknown): string {
  const name = error instanceof Error || error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Kamera izni verilmedi. Tarayıcının site ayarlarından kameraya izin verip tekrar dene.';
  }
  return 'Kamera açılamadı. Kodu elle yaz.';
}

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
    let stream: MediaStream | null = null;
    let reader: QrReader | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const last = { value: '', at: 0 };

    const tick = async () => {
      if (stopped || !video.current || !reader) return;
      try {
        const value = (await reader.read(video.current))?.trim();
        const now = Date.now();
        if (!stopped && value && (value !== last.value || now - last.at > REPEAT_MS)) {
          last.value = value;
          last.at = now;
          scan.current(value);
        }
      } catch {
        // A frame that could not be read: the next one is tried
      }
      if (!stopped) timer = setTimeout(() => void tick(), 250);
    };

    // The reader loads while the camera asks for permission
    const loading = openQrReader().then(
      (opened) => {
        if (stopped) opened.close();
        else reader = opened;
        return true;
      },
      () => false,
    );

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
        if (!(await loading)) {
          media.getTracks().forEach((track) => track.stop());
          if (!stopped) setFailed('Kod okuyucu yüklenemedi. Kodu elle yaz.');
          return;
        }
        void tick();
      })
      .catch((error: unknown) => {
        if (!stopped) setFailed(cameraFailure(error));
      });

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      reader?.close();
    };
  }, []);

  return (
    <section aria-label="Kamerayla tara" className="space-y-2">
      <div className="relative overflow-hidden rounded-lg bg-black">
        <video
          ref={video}
          muted
          autoPlay
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
