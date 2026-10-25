'use client';

import { buttonVariants } from '@skylab-kulubu/skylcn-ui';
import { useEffect, useState } from 'react';
import { saveClass } from '@/components/chrome/SaveButton';
import { EventCoverImage } from '@/components/scheduling/EventCoverImage';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { publicShortUrl } from '@/lib/api/urls';
import { previousFormHref, previousForms } from '@/lib/event-copy';
import { APPLY_SLOT_KEY, formsAdminOrigin } from '@/lib/event-forms';
import { publicMediaUrl } from '@/lib/event-media';

/**
 * A copy's "Geçen seferin formundan yeni form oluştur" (SPEC §5.4): Skyforms
 * opens a new form with the source's questions, and back here the form slot
 * flow links it to the copy with a new short link. One per Skyforms form of
 * the source whose place on the copy is empty.
 */
function PreviousForms({ event }: { event: CoreEvent }) {
  const [source, setSource] = useState<CoreEvent | null>(null);
  const sourceId = event.copiedFromEventId;

  useEffect(() => {
    if (!sourceId) return;
    let cancelled = false;
    void eventsApi
      .get(sourceId)
      .then((row) => {
        if (!cancelled) setSource(row);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sourceId]);

  if (!source) return null;
  const origin = formsAdminOrigin();
  const href = typeof window !== 'undefined' ? window.location.href : '';
  const forms = previousForms(source, event, origin)
    .map((form) => ({ form, link: previousFormHref(origin, href, event, form) }))
    .filter((row) => row.link);
  if (!forms.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {forms.map(({ form, link }) => (
        <a
          key={form.slotKey}
          href={link ?? undefined}
          className={
            form.slotKey === APPLY_SLOT_KEY
              ? saveClass
              : buttonVariants({ variant: 'outline', size: 'sm' })
          }
        >
          {form.slotKey === APPLY_SLOT_KEY
            ? 'Geçen seferin formundan yeni form oluştur'
            : `Geçen seferin formundan yeni form: ${form.label}`}
        </a>
      ))}
    </div>
  );
}

/** Genel bakış tab: the event's cover, description and guest form link. */
export default function EventOverviewPage() {
  const { event, canMutate } = useEventWorkspace();

  return (
    <div className="space-y-6">
      {canMutate && event.copiedFromEventId ? <PreviousForms event={event} /> : null}
      {event.coverImageUrl ? (
        <EventCoverImage src={publicMediaUrl(event.coverImageUrl)} className="max-w-3xl" />
      ) : null}
      <p className="text-muted-foreground text-sm whitespace-pre-wrap">
        {event.description || '—'}
      </p>
      {event.formAlias || event.formUrl ? (
        <p className="text-3xs text-subtle-foreground">
          Misafir başvurusu (hesabı olmayanlar):{' '}
          <a
            className="text-skylab-300 hover:text-foreground"
            href={event.formAlias ? publicShortUrl(event.formAlias) : event.formUrl}
            target="_blank"
            rel="noreferrer"
          >
            {event.formAlias ? publicShortUrl(event.formAlias) : event.formUrl}
          </a>
        </p>
      ) : null}
    </div>
  );
}
