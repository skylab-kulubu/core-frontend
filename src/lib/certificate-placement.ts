import type { BackgroundFit, BackgroundPlacement, CertificateLayout } from '@/lib/api/certificates';

/** A box on the page in layout px; it may reach past the page, which clips it. */
export type Rect = { left: number; top: number; width: number; height: number };

export type Size = { width: number; height: number };

/** The page sizes core accepts, per side (ValidateLayout). */
export const PAGE_MIN = 300;
export const PAGE_MAX = 4000;
export const SCALE_MIN = 0.1;
export const SCALE_MAX = 10;

/**
 * How core prints an image background of a layout without a placement: the
 * page covered, the image centred (CSS background-size:cover; center).
 */
export const LEGACY_IMAGE_PLACEMENT: BackgroundPlacement = {
  fit: 'cover',
  x: 0.5,
  y: 0.5,
  scale: 1,
};

export const FIT_LABELS: Record<BackgroundFit, string> = {
  contain: 'Sığdır',
  cover: 'Doldur (kırp)',
  fill: 'Uzat',
  fitWidth: 'Genişliğe sığdır',
  fitHeight: 'Yüksekliğe sığdır',
  none: 'Orijinal boyut',
};

/**
 * The box a background of natural size srcW×srcH takes on a pageW×pageH page.
 * The same function as core-backend's `PlaceBackground`
 * (internal/certificate/placement.go); both are tested with the same golden table.
 */
export function placeBackground(
  pageW: number,
  pageH: number,
  srcW: number,
  srcH: number,
  p: BackgroundPlacement,
): Rect {
  if (p.fit === 'fill') return { left: 0, top: 0, width: pageW, height: pageH };
  let k: number;
  switch (p.fit) {
    case 'contain':
      k = Math.min(pageW / srcW, pageH / srcH);
      break;
    case 'cover':
      k = Math.max(pageW / srcW, pageH / srcH);
      break;
    case 'fitWidth':
      k = pageW / srcW;
      break;
    case 'fitHeight':
      k = pageH / srcH;
      break;
    default: // none
      k = 1;
  }
  k *= p.scale;
  const w = srcW * k;
  const h = srcH * k;
  return { left: (pageW - w) * p.x, top: (pageH - h) * p.y, width: w, height: h };
}

function clamp(value: number, min: number, max: number, fallback: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

/** A placement core accepts: x, y and scale in range; fill sends scale 1. */
export function normalizePlacement(p: BackgroundPlacement): BackgroundPlacement {
  return {
    fit: p.fit,
    x: clamp(p.x, 0, 1, 0.5),
    y: clamp(p.y, 0, 1, 0.5),
    scale: p.fit === 'fill' ? 1 : clamp(p.scale, SCALE_MIN, SCALE_MAX, 1),
  };
}

/** The background's ratio differs from the page's by more than `tolerance` (0.5 %). */
export function ratioDiffers(page: Size, source: Size, tolerance = 0.005) {
  const ratio = source.width / source.height / (page.width / page.height);
  return Math.abs(ratio - 1) > tolerance;
}

/**
 * The page size that fits a background of the given natural size: the size
 * itself, scaled with its ratio into 300–4000 px when it is outside; null when
 * the ratio cannot fit in that range (e.g. 20:1).
 */
export function pageForBackground(source: Size): Size | null {
  if (!(source.width > 0 && source.height > 0)) return null;
  let { width, height } = source;
  const longer = Math.max(width, height);
  if (longer > PAGE_MAX) {
    width = (width * PAGE_MAX) / longer;
    height = (height * PAGE_MAX) / longer;
  }
  const shorter = Math.min(width, height);
  if (shorter < PAGE_MIN) {
    width = (width * PAGE_MIN) / shorter;
    height = (height * PAGE_MIN) / shorter;
  }
  width = Math.round(width);
  height = Math.round(height);
  if (width < PAGE_MIN || height < PAGE_MIN || width > PAGE_MAX || height > PAGE_MAX) return null;
  return { width, height };
}

/**
 * The layout on a page of another size: every layer scaled with the page
 * (its font with the smaller of the two scales) and kept inside the page.
 */
export function resizeCertificateLayout(layout: CertificateLayout, size: Size): CertificateLayout {
  const scaleX = size.width / layout.width;
  const scaleY = size.height / layout.height;
  const fontScale = Math.min(scaleX, scaleY);
  return {
    ...layout,
    width: size.width,
    height: size.height,
    orientation: size.width >= size.height ? 'landscape' : 'portrait',
    elements: layout.elements.map((element) => {
      const x = Math.min(size.width - 1, Math.round(element.x * scaleX));
      const y = Math.min(size.height - 1, Math.round(element.y * scaleY));
      return {
        ...element,
        x,
        y,
        width: Math.max(1, Math.min(size.width - x, Math.round(element.width * scaleX))),
        height: Math.max(1, Math.min(size.height - y, Math.round(element.height * scaleY))),
        fontSize: element.fontSize
          ? Math.min(300, Math.max(1, Math.round(element.fontSize * fontScale)))
          : 0,
      };
    }),
  };
}

/**
 * The page fitted to the background: page size from the background's natural
 * size, layers scaled, the background stretched to the page (a difference of
 * at most 0.1 % after rounding). Null when the ratio cannot fit.
 */
export function fitPageToBackground(
  layout: CertificateLayout,
  source: Size,
): CertificateLayout | null {
  const page = pageForBackground(source);
  if (!page) return null;
  const resized =
    page.width === layout.width && page.height === layout.height
      ? layout
      : resizeCertificateLayout(layout, page);
  return { ...resized, backgroundPlacement: { fit: 'fill', x: 0.5, y: 0.5, scale: 1 } };
}

/** Absolute CSS units in px (96 per inch). */
const SVG_UNITS: Record<string, number> = {
  px: 1,
  pt: 96 / 72,
  pc: 16,
  mm: 96 / 25.4,
  cm: 96 / 2.54,
  in: 96,
};
const CSS_NUMBER = /^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/;

/** A CSS <number>, or NaN for what a browser does not take as one ("5.", "0x10", "Inf"). */
function cssNumber(value: string) {
  return CSS_NUMBER.test(value) ? Number(value) : Number.NaN;
}

/**
 * An SVG width or height in px; 0 when it is missing, not a number or in a
 * relative unit (%, em). The unit follows the number with no space.
 */
function svgLength(value: string | null) {
  let text = (value ?? '').trim().toLowerCase();
  let factor = 1;
  const unit = SVG_UNITS[text.slice(-2)];
  if (text.length > 2 && unit) {
    factor = unit;
    text = text.slice(0, -2);
  }
  const n = cssNumber(text);
  return Number.isFinite(n) ? n * factor : 0;
}

/**
 * An SVG's natural size as core reads it: the root's width and height in an
 * absolute unit; when one is missing or in a relative unit, the viewBox gives
 * it, keeping the viewBox's ratio. Null when neither gives one.
 */
export function svgNaturalSize(text: string): Size | null {
  const root = /<svg\b([^>]*)>/i.exec(text.replace(/<!--[\s\S]*?-->/g, ''));
  if (!root) return null;
  const attr = (name: string) => {
    const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(root[1]);
    return match ? (match[1] ?? match[2] ?? '') : null;
  };
  const w = svgLength(attr('width'));
  const h = svgLength(attr('height'));
  const box = (attr('viewBox') ?? '')
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(cssNumber);
  const [vw, vh] = box.length === 4 ? [box[2], box[3]] : [0, 0];
  if (w > 0 && h > 0) return { width: w, height: h };
  if (!(vw > 0 && vh > 0)) return null;
  if (w > 0) return { width: w, height: (w * vh) / vw };
  if (h > 0) return { width: (h * vw) / vh, height: h };
  return { width: vw, height: vh };
}
