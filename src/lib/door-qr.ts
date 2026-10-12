import { ProblemError } from '@/lib/api/core';

export const DOOR_QR_FALLBACK_REFRESH_SECONDS = 15;
export const DOOR_QR_RATE_LIMITED_WAIT_SECONDS = 60;
export const DOOR_QR_CLOSED_RETRY_SECONDS = 30;
/**
 * Core mints the guest QR, and takes guest check-ins with it, from this many hours before a
 * session starts until this many hours after it ends (core's DOOR_QR_SESSION_GRACE default).
 */
export const DOOR_GUEST_QR_WINDOW_HOURS = 12;

/** The core's SVG as an image address; the SVG is ASCII, and an <img> never runs scripts in it. */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export type DoorQrFailure = {
  message: string;
  /** Seconds until the next try, or null when asking again cannot help. */
  retryAfterSeconds: number | null;
  /** Whether the QR on screen must go now; otherwise it stays until it expires. */
  hideQr: boolean;
};

export function doorQrFailure(err: unknown, refreshAfterSeconds: number): DoorQrFailure {
  if (err instanceof ProblemError) {
    if (err.status === 403 && err.code === 'session_closed') {
      return {
        message: `Oturum şu an açık değil; misafir QR’ı oturumdan ${DOOR_GUEST_QR_WINDOW_HOURS} saat önce açılır, bitişinden ${DOOR_GUEST_QR_WINDOW_HOURS} saat sonra kapanır.`,
        retryAfterSeconds: DOOR_QR_CLOSED_RETRY_SECONDS,
        hideQr: true,
      };
    }
    if (err.status === 403) {
      return { message: 'Bu etkinlikte görevli değilsin.', retryAfterSeconds: null, hideQr: true };
    }
    if (err.status === 401) {
      return {
        message: 'Oturum süresi doldu; yeniden giriş yap.',
        retryAfterSeconds: null,
        hideQr: true,
      };
    }
    if (err.status === 404) {
      return { message: 'Oturum bulunamadı.', retryAfterSeconds: null, hideQr: true };
    }
    if (err.status === 429) {
      return {
        message: 'Çok sık yenilendi; QR birazdan gelecek.',
        retryAfterSeconds: DOOR_QR_RATE_LIMITED_WAIT_SECONDS,
        hideQr: false,
      };
    }
  }
  return { message: 'QR yenilenemedi.', retryAfterSeconds: refreshAfterSeconds, hideQr: false };
}
