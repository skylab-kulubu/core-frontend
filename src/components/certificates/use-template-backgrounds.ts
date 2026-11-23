'use client';

import { useEffect, useState } from 'react';
import type { CertificateLayout } from '@/lib/api/certificates';
import { mediaApi } from '@/lib/api/media';
import { publicMediaUrl } from '@/lib/event-media';

export type TemplateBackground = { url: string; type?: string } | null;

/**
 * The background picture of each layout, by its Media id, read once per id: a template's
 * card and a default's row draw it small. An unreadable Media is null (the page colour shows).
 */
export function useTemplateBackgrounds(
  layouts: ReadonlyArray<CertificateLayout | undefined>,
): Record<string, TemplateBackground> {
  const ids = [
    ...new Set(layouts.map((layout) => layout?.backgroundMediaId).filter(Boolean) as string[]),
  ];
  const key = ids.sort().join(',');
  const [found, setFound] = useState<Record<string, TemplateBackground>>({});

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const wanted = key.split(',');
    void Promise.all(
      wanted.map((id) =>
        mediaApi.get(id).then(
          (media): [string, TemplateBackground] => [
            id,
            { url: publicMediaUrl(media.url), type: media.type },
          ],
          (): [string, TemplateBackground] => [id, null],
        ),
      ),
    ).then((rows) => {
      if (!cancelled) setFound((current) => ({ ...current, ...Object.fromEntries(rows) }));
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return found;
}

/** The layout a template shows: its published version's, or its draft's before one. */
export function shownLayout(template: {
  publishedVersion?: { layout?: CertificateLayout };
  draftLayout?: CertificateLayout;
}): CertificateLayout {
  return template.publishedVersion?.layout ?? template.draftLayout ?? BLANK_LAYOUT;
}

/** A blank A4 page, for a template whose layout did not come with it. */
const BLANK_LAYOUT: CertificateLayout = {
  width: 1123,
  height: 794,
  orientation: 'landscape',
  backgroundColor: '#ffffff',
  elements: [],
};
