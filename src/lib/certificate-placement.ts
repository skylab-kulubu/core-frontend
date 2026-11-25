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
 * (its font with the smaller of the two scales) and kept inside the page. The
 * verification QR keeps its shape: scaled by the smaller scale around its centre.
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
      if (element.kind === 'verificationQr') {
        // A QR stays square: one scale for both sides, its centre where the page puts it
        const width = Math.max(1, Math.min(size.width, Math.round(element.width * fontScale)));
        const height = Math.max(1, Math.min(size.height, Math.round(element.height * fontScale)));
        const centreX = (element.x + element.width / 2) * scaleX;
        const centreY = (element.y + element.height / 2) * scaleY;
        return {
          ...element,
          x: Math.max(0, Math.min(size.width - width, Math.round(centreX - width / 2))),
          y: Math.max(0, Math.min(size.height - height, Math.round(centreY - height / 2))),
          width,
          height,
        };
      }
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

/**
 * The smallest and largest natural side, in px, core places a background of
 * (background_size_unknown outside); the same bounds as core-backend's.
 */
export const BACKGROUND_SIDE_MIN = 1e-3;
export const BACKGROUND_SIDE_MAX = 1e6;

/** A natural size core can place a background of. */
export function placeableSize(size: Size | null | undefined): size is Size {
  return Boolean(
    size &&
    Number.isFinite(size.width) &&
    Number.isFinite(size.height) &&
    size.width >= BACKGROUND_SIDE_MIN &&
    size.height >= BACKGROUND_SIDE_MIN &&
    size.width <= BACKGROUND_SIDE_MAX &&
    size.height <= BACKGROUND_SIDE_MAX,
  );
}

/** How much of an SVG is read for its root element (64 KiB). */
const SVG_HEAD = 64 * 1024;

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

/** A CSS <number>, or NaN for what a browser does not take as one ("5.", "0x1p4", "Inf"). */
function cssNumber(value: string) {
  const n = CSS_NUMBER.test(value) ? Number(value) : Number.NaN;
  return Number.isFinite(n) ? n : Number.NaN;
}

/**
 * An SVG width or height in px; 0 when it is missing, not a number or in a
 * relative unit (%, em). The unit follows the number with no space ("10 cm"
 * is no length).
 */
function svgLength(value: string | null) {
  let text = (value ?? '').trim().toLowerCase();
  let factor = 1;
  if (text.length > 2 && Object.hasOwn(SVG_UNITS, text.slice(-2))) {
    factor = SVG_UNITS[text.slice(-2)];
    text = text.slice(0, -2);
  }
  const n = cssNumber(text);
  return Number.isFinite(n) ? n * factor : 0;
}

/**
 * The first element's name and attribute text, past the XML declaration,
 * comments, DOCTYPE and CDATA; read with indexOf, in one pass over the head.
 */
function svgRoot(head: string): { name: string; attributes: string } | null {
  const skips: [string, string][] = [
    ['<!--', '-->'],
    ['<?', '?>'],
    ['<![CDATA[', ']]>'],
    ['<!', '>'],
  ];
  let at = head.indexOf('<');
  while (at >= 0) {
    const skip = skips.find(([open]) => head.startsWith(open, at));
    if (!skip) break;
    const end = head.indexOf(skip[1], at + skip[0].length);
    if (end < 0) return null;
    at = head.indexOf('<', end + skip[1].length);
  }
  if (at < 0) return null;
  const tag = /^<([A-Za-z_][\w.:-]*)/.exec(head.slice(at, at + 256));
  if (!tag) return null;
  // The attributes run to the first > outside quotes
  let quote = '';
  for (let i = at + tag[0].length; i < head.length; i++) {
    const c = head[i];
    if (quote) {
      if (c === quote) quote = '';
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '>') {
      return { name: tag[1], attributes: head.slice(at + tag[0].length, i) };
    }
  }
  return null;
}

/**
 * An SVG's natural size as core reads it (core-backend svgSize): the root
 * element's width and height in an absolute unit; when one is missing or in a
 * relative unit, the viewBox gives it, keeping the viewBox's ratio. Null when
 * the root is not an svg or neither gives a size.
 */
export function svgNaturalSize(text: string): Size | null {
  const root = svgRoot(text.slice(0, SVG_HEAD));
  if (!root || root.name.split(':').pop() !== 'svg') return null;
  const attr = (name: string) => {
    const match = new RegExp(`(?:^|\\s)(?:[\\w.-]+:)?${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(
      root.attributes,
    );
    return match ? (match[1] ?? match[2] ?? '') : null;
  };
  const w = svgLength(attr('width'));
  const h = svgLength(attr('height'));
  const box = (attr('viewBox') ?? '').split(/[ ,\t\n\r]+/).filter(Boolean);
  const [vw, vh] = box.length === 4 ? [cssNumber(box[2]), cssNumber(box[3])] : [0, 0];
  if (w > 0 && h > 0) return { width: w, height: h };
  if (!(vw > 0 && vh > 0)) return null;
  if (w > 0) return { width: w, height: (w * vh) / vw };
  if (h > 0) return { width: (h * vw) / vh, height: h };
  return { width: vw, height: vh };
}
