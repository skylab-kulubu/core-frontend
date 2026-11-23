'use client';

import { buttonVariants, cn } from '@skylab-kulubu/skylcn-ui';
import { useEffect, useState } from 'react';
import { saveClass } from '@/components/chrome/SaveButton';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { EventOverview } from '@/components/scheduling/overview/EventOverview';
import { eventDaysApi } from '@/lib/api/eventDays';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import type { EventSession } from '@/lib/api/sessions';
import { previousFormHref, previousForms, previousSessionForms } from '@/lib/event-copy';
import { APPLY_SLOT_KEY, formsAdminOrigin } from '@/lib/event-forms';
import { BUTTON_TEXT } from '@/lib/ui/type-scale';

/**
 * A copy's "Geçen seferin formundan yeni form oluştur" (SPEC §5.4): Skyforms
 * opens a new form with the source's questions, and back here the form slot
 * flow links it to the copy with a new short link. One per Skyforms form of
 * the source whose place on the copy is empty: its feedback form, and in the
 * per-Session mode its Sessions' forms too (the copy takes the mode, not the
 * forms).
 */
function PreviousForms({ event, sessions }: { event: CoreEvent; sessions: EventSession[] }) {
  const [source, setSource] = useState<CoreEvent | null>(null);
  const [sourceSessions, setSourceSessions] = useState<EventSession[]>([]);
  const sourceId = event.copiedFromEventId;
  const perSession = event.feedbackMode === 'per_session';

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

  useEffect(() => {
    if (!sourceId || !perSession) return;
    let cancelled = false;
    void eventDaysApi
      .listByEvent(sourceId)
      .then((days) => Promise.all(days.map((day) => eventDaysApi.listSessions(day.id))))
      .then((rows) => {
        if (!cancelled) setSourceSessions(rows.flat());
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sourceId, perSession]);

  if (!source) return null;
  const origin = formsAdminOrigin();
  const href = typeof window !== 'undefined' ? window.location.href : '';
  const forms = [
    ...previousForms(source, event, origin),
    ...(perSession ? previousSessionForms(sourceSessions, sessions, origin) : []),
  ]
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
              : cn(buttonVariants({ variant: 'outline', size: 'sm' }), BUTTON_TEXT)
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

/**
 * Genel bakış: the event's essentials, its figures and charts, what runs now, the latest
 * registrations, what is left to do, its links, place, certificates and files.
 */
export default function EventOverviewPage() {
  const { event, sessions, canMutate } = useEventWorkspace();
  return (
    <EventOverview
      previous={
        canMutate && event.copiedFromEventId ? (
          <PreviousForms event={event} sessions={sessions} />
        ) : null
      }
    />
  );
}
