'use client';

import { useEffect, useState } from 'react';
import { certificatesApi, type CertificateFont } from '@/lib/api/certificates';

/**
 * Uploaded certificate fonts in the browser (core docs/certificate-fonts.md).
 * The file is read with the caller's token and handed to the FontFace API as
 * bytes, under the name core's page gives it (`cf-<mediaId>`): no font URL is
 * in the panel's CSS, so its `font-src 'self'` stays as it is.
 */

/** The line the fonts page draws each font in: every Turkish letter. */
export const FONT_SAMPLE = "Ağrı Dağı'nda gün ışığı · ĞÜŞİÖÇ ğüşıöç";

/** The CSS family core's page sets an uploaded font under. */
export const userFontName = (mediaId: string) => `cf-${mediaId}`;

/** A font's face in Turkish: `700`, `400 italik`. */
export function fontFaceLabel(font: Pick<CertificateFont, 'weight' | 'style'>) {
  return font.style === 'italic' ? `${font.weight} italik` : String(font.weight);
}

/** The lowercase/uppercase Turkish letters first, then the rest: what the warning names. */
const TURKISH = 'ğĞıİşŞçÇöÖüÜ';
const SHOWN = 6;

/** "ğ, ı" or "ğ, ı, ş, İ, ç, Ç ve 8 harf daha": the letters a font lacks, Turkish first. */
export function missingLettersText(missing: string) {
  const letters = [...new Set([...missing])];
  letters.sort((a, b) => Number(!TURKISH.includes(a)) - Number(!TURKISH.includes(b)));
  const shown = letters.slice(0, SHOWN).join(', ');
  const rest = letters.length - SHOWN;
  return rest > 0 ? `${shown} ve ${rest} harf daha` : shown;
}

/** The warning a layer in a font with letters missing shows; '' when none are. */
export function missingLettersWarning(missing: string, recipientName = false) {
  if (!missing) return '';
  const line = `Bu yazı tipinde ${missingLettersText(missing)} yok`;
  return recipientName ? `${line}; adlarda başka yazı tipine düşebilir.` : `${line}.`;
}

// One load per file for the page's life; a failed or cancelled one may be tried again
const loads = new Map<string, Promise<boolean>>();

/**
 * Loads `font`'s file as `cf-<mediaId>` into `document.fonts`; true once the
 * browser can draw it. The face covers every weight (`1 1000`), as core's page
 * declares it, so the browser never draws a made-up bold of it. `signal`
 * cancels the download (a page left before it came); a load already under way
 * for another page is shared. Without the FontFace API (jsdom) it resolves false.
 */
export function loadCertificateFont(font: CertificateFont, signal?: AbortSignal): Promise<boolean> {
  const known = loads.get(font.mediaId);
  if (known) return known;
  if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) {
    return Promise.resolve(false);
  }
  const load = certificatesApi
    .fontFile(font.id, signal)
    .then((blob) => blob.arrayBuffer())
    .then((buffer) => {
      const face = new FontFace(userFontName(font.mediaId), buffer, {
        weight: '1 1000',
        style: font.style,
      });
      return face.load();
    })
    .then((face) => {
      document.fonts.add(face);
      return true;
    })
    .catch(() => {
      loads.delete(font.mediaId);
      return false;
    });
  loads.set(font.mediaId, load);
  return load;
}

/**
 * Loads each of `fonts` and answers the Media ids loaded so far, so a page
 * draws again once a face is in. Leaving the page cancels its downloads.
 */
export function useLoadedCertificateFonts(fonts: readonly CertificateFont[]) {
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(() => new Set());
  const key = fonts.map((font) => `${font.id}:${font.mediaId}`).join(',');
  useEffect(() => {
    const controller = new AbortController();
    for (const font of fonts) {
      void loadCertificateFont(font, controller.signal).then((ok) => {
        if (!ok || controller.signal.aborted) return;
        setLoaded((current) =>
          current.has(font.mediaId) ? current : new Set([...current, font.mediaId]),
        );
      });
    }
    return () => controller.abort();
    // `key` names the fonts; the array itself is a new one each render
  }, [key]);
  return loaded;
}
