import type { TicketImageCrop } from '@/lib/api/ticket-image';

/** The PDF ticket's band: 182 × 24 mm (core ticketimage.BandWidthMM, BandHeightMM). */
export const BAND_WIDTH_MM = 182;
export const BAND_HEIGHT_MM = 24;
export const BAND_ASPECT = BAND_WIDTH_MM / BAND_HEIGHT_MM;

/** How far the cropper zooms in at most: an eighth of the widest strip. */
export const MAX_ZOOM = 8;

/** core's smallest region side (ticketimage minCropSide), in fractions of the image. */
export const MIN_CROP_SIDE = 0.01;

/** The narrowest region, in pixels: core's narrowest band (bandMinWidth). */
export const MIN_CROP_PIXELS = 600;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The widest strip of the band's shape an image of w × h pixels holds, centred (zoom 1). */
export function fullCrop(w: number, h: number): TicketImageCrop {
  if (w <= 0 || h <= 0) return { x: 0, y: 0, w: 1, h: 1 };
  if (w / h >= BAND_ASPECT) {
    const cw = (h * BAND_ASPECT) / w;
    return { x: (1 - cw) / 2, y: 0, w: cw, h: 1 };
  }
  const ch = w / BAND_ASPECT / h;
  return { x: 0, y: (1 - ch) / 2, w: 1, h: ch };
}

/**
 * How far an image of w × h pixels zooms in: up to MAX_ZOOM, while the region keeps each side at
 * least MIN_CROP_SIDE of the image and is at least MIN_CROP_PIXELS wide. An image whose widest
 * strip is narrower than that does not zoom.
 */
export function maxZoom(w: number, h: number): number {
  const full = fullCrop(w, h);
  const limit = Math.min(
    MAX_ZOOM,
    full.w / MIN_CROP_SIDE,
    full.h / MIN_CROP_SIDE,
    (full.w * w) / MIN_CROP_PIXELS,
  );
  return Math.max(1, limit);
}

/** The crop's zoom against the widest strip, 1 to maxZoom. */
export function zoomOf(crop: TicketImageCrop, w: number, h: number): number {
  return clamp(fullCrop(w, h).w / crop.w, 1, maxZoom(w, h));
}

/** The band-shaped region at zoom whose centre is (cx, cy), kept inside the image. */
export function cropAt(
  w: number,
  h: number,
  zoom: number,
  cx: number,
  cy: number,
): TicketImageCrop {
  const full = fullCrop(w, h);
  const z = clamp(zoom, 1, maxZoom(w, h));
  const cw = full.w / z;
  const ch = full.h / z;
  return {
    x: clamp(cx - cw / 2, 0, 1 - cw),
    y: clamp(cy - ch / 2, 0, 1 - ch),
    w: cw,
    h: ch,
  };
}

/** The crop's centre. */
export function centreOf(crop: TicketImageCrop): { cx: number; cy: number } {
  return { cx: crop.x + crop.w / 2, cy: crop.y + crop.h / 2 };
}

/** The crop moved by (dx, dy) fractions of the image, kept inside it. */
export function moveCrop(crop: TicketImageCrop, dx: number, dy: number): TicketImageCrop {
  return {
    ...crop,
    x: clamp(crop.x + dx, 0, 1 - crop.w),
    y: clamp(crop.y + dy, 0, 1 - crop.h),
  };
}

/** A saved crop fits a w × h image when it lies in it and has the band's shape there. */
export function cropFits(crop: TicketImageCrop | undefined, w: number, h: number): boolean {
  if (!crop || w <= 0 || h <= 0) return false;
  const inside =
    crop.x >= 0 && crop.y >= 0 && crop.x + crop.w <= 1.000001 && crop.y + crop.h <= 1.000001;
  const shape = (crop.w * w) / (crop.h * h);
  return inside && Math.abs(shape / BAND_ASPECT - 1) < 0.02;
}

/** Where the whole image sits in a band-shaped frame to show only the crop, in % of the frame. */
export function imagePlacement(crop: TicketImageCrop) {
  return {
    width: `${100 / crop.w}%`,
    height: `${100 / crop.h}%`,
    left: `${(-crop.x / crop.w) * 100}%`,
    top: `${(-crop.y / crop.h) * 100}%`,
  };
}
