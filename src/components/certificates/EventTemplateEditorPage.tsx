'use client';

import { buttonVariants, cn } from '@skylab-kulubu/skylcn-ui';
import { ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { PageSkeleton } from '@/components/chrome/PageSkeleton';
import { SaveButton } from '@/components/chrome/SaveButton';
import { StateCard } from '@/components/chrome/StateCard';
import { CertificateTemplateEditor } from '@/components/certificates/CertificateTemplateEditor';
import {
  createEventTemplate,
  useEventTemplateState,
} from '@/components/certificates/EventTemplateRow';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { coreProblemMessage } from '@/lib/core-problems';
import { eventEditHref, eventTabHref } from '@/lib/event-workspace';
import { useTeamCan, viewerDecision } from '@/lib/use-app-can';
import { BUTTON_TEXT } from '@/lib/ui/type-scale';

/**
 * /events/[id]/certificate-template: the editor of the Event's own template,
 * without the sidebar. Back leads to where it was opened from: the
 * Sertifikalar tab, else the edit page's Sertifika section.
 */
export function EventTemplateEditorPage({
  eventId,
  from,
}: {
  eventId: string;
  from?: 'certificates';
}) {
  const teamCan = useTeamCan();
  const [event, setEvent] = useState<CoreEvent | null>(null);
  const [eventError, setEventError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const template = useEventTemplateState(eventId);

  useEffect(() => {
    let cancelled = false;
    eventsApi
      .get(eventId)
      .then((ev) => {
        if (!cancelled) setEvent(ev);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setEventError(coreProblemMessage(cause, 'Etkinlik yüklenemedi'));
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const back =
    from === 'certificates'
      ? eventTabHref(eventId, 'certificates')
      : `${eventEditHref(eventId)}#sertifika`;
  const canEditEvent = event
    ? (viewerDecision(event, 'event.update') ?? teamCan(event.ownerTeam, 'event.update'))
    : false;

  const shell = (body: ReactNode) => (
    <main className="mx-auto w-full max-w-[1440px] space-y-5 px-4 py-4 sm:px-6">
      <header className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1">
        <Link
          href={back}
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            BUTTON_TEXT,
            '-ml-2 max-w-full',
          )}
        >
          <ArrowLeft aria-hidden />
          <span className="truncate">{event?.name ?? 'Etkinliğe dön'}</span>
        </Link>
        <h1 className="text-foreground text-sm font-semibold">
          <span aria-hidden className="text-subtle-foreground mr-1">
            ·
          </span>
          Sertifika şablonu
        </h1>
      </header>
      {body}
    </main>
  );

  if (eventError) return shell(<StateCard title={eventError} tone="danger" />);
  if (!event || template.status === 'loading') return shell(<PageSkeleton variant="workspace" />);
  if (template.status === 'failed')
    return shell(<StateCard title={template.error} tone="danger" />);
  if (template.view.legacy) {
    return shell(<StateCard title="Etkinliğe özel şablon bu sunucuda yok" />);
  }

  const own = template.view.eventTemplate;
  if (!own) {
    return shell(
      <StateCard title="Bu etkinliğin kendi şablonu yok">
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        {canEditEvent ? (
          <SaveButton
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const failed = await createEventTemplate(eventId, () => void template.reload());
              setError(failed ?? undefined);
              setBusy(false);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden /> Etkinliğe özel şablon oluştur
          </SaveButton>
        ) : null}
      </StateCard>,
    );
  }

  return shell(
    <CertificateTemplateEditor
      key={own.id}
      templateId={own.id}
      eventId={eventId}
      eventEditable={canEditEvent}
    />,
  );
}
