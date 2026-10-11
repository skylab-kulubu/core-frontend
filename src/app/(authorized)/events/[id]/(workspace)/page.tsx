'use client';

import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { publicShortUrl } from '@/lib/api/urls';
import { publicMediaUrl } from '@/lib/event-media';

/** Genel bakış tab: the event's cover, description and guest form link. */
export default function EventOverviewPage() {
  const { event } = useEventWorkspace();

  return (
    <div className="space-y-6">
      {event.coverImageUrl ? (
        <img
          src={publicMediaUrl(event.coverImageUrl)}
          alt=""
          className="h-40 w-full rounded-lg object-cover"
        />
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
