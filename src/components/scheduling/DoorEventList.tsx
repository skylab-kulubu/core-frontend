'use client';

import { buttonVariants, cn } from '@skylab-kulubu/skylcn-ui';
import { DoorOpen } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { EmptyState } from '@/components/chrome/PageState';
import { PageSkeleton } from '@/components/chrome/PageSkeleton';
import { SectionHeading } from '@/components/chrome/PanelChart';
import { PageHeader } from '@/components/layout/PageHeader';
import { eventDaysApi } from '@/lib/api/eventDays';
import type { EventSession } from '@/lib/api/sessions';
import { ticketsApi, type DoorEvent } from '@/lib/api/tickets';
import { coreProblemMessage } from '@/lib/core-problems';
import { sessionClock, sessionNowAndNext } from '@/lib/event-overview';
import { eventDoorHref } from '@/lib/event-workspace';
import { eventEndsAt } from '@/lib/events-view';
import { BUTTON_TEXT, TEXT_SECONDARY } from '@/lib/ui/type-scale';

const DAY = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Istanbul',
});

function when(event: DoorEvent): string {
  if (!event.startDate) return event.location || '';
  const date = new Date(event.startDate);
  const day = Number.isNaN(date.getTime()) ? '' : DAY.format(date);
  return [day, event.location].filter(Boolean).join(' · ');
}

/** Whether the event runs now, by its dates (core's end rule). */
export function runsNow(event: Pick<DoorEvent, 'startDate' | 'endDate'>, now = new Date()) {
  const start = event.startDate ? Date.parse(event.startDate) : Number.NaN;
  if (Number.isNaN(start) || start > now.getTime()) return false;
  const end = eventEndsAt(event);
  return end === null || end > now.getTime();
}

/** Whether the event is over, by core's end rule; an undated one never is. */
export function hasEnded(event: Pick<DoorEvent, 'startDate' | 'endDate'>, now = new Date()) {
  const end = eventEndsAt(event);
  return end !== null && end <= now.getTime();
}

/** A running door: the session on now and how many came in. */
type Live = { session: EventSession | null; next: EventSession | null; entered: number | null };

async function liveDoor(event: DoorEvent): Promise<Live> {
  const days = await eventDaysApi.listByEvent(event.id);
  const sessions = (await Promise.all(days.map((day) => eventDaysApi.listSessions(day.id)))).flat();
  const { current, next } = sessionNowAndNext(sessions);
  if (!current) return { session: null, next, entered: null };
  const activity = await ticketsApi.doorActivity(current.id).catch(() => null);
  return { session: current, next, entered: activity ? activity.total : null };
}

function NowCard({ event, live }: { event: DoorEvent; live?: Live }) {
  const session = live?.session;
  return (
    <div className="border-border-subtle bg-card flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-foreground-strong truncate text-lg font-semibold">{event.name}</p>
        <p className={cn('text-secondary-foreground', TEXT_SECONDARY)}>
          {session
            ? `${session.title} · ${sessionClock(session)}`
            : live?.next
              ? `Sıradaki: ${live.next.title} · ${sessionClock(live.next)}`
              : live
                ? 'Süren oturum yok'
                : event.location}
        </p>
      </div>
      {session && live?.entered !== null && live?.entered !== undefined ? (
        <div className="sm:text-right">
          <p className="text-foreground-strong text-3xl leading-none font-semibold tabular-nums">
            {live.entered}
          </p>
          <p className={cn('text-muted-foreground', TEXT_SECONDARY)}>giren</p>
        </div>
      ) : null}
      <Link
        href={eventDoorHref(event.id)}
        aria-label={`${event.name}: kapıyı aç`}
        className={cn(
          buttonVariants({ variant: 'primary', size: 'lg' }),
          BUTTON_TEXT,
          'w-full sm:w-auto',
        )}
      >
        <DoorOpen aria-hidden />
        Kapıyı aç
      </Link>
    </div>
  );
}

/**
 * The doors the person staffs: the ones running now first, large, with the session on and the
 * count, then the ones to come. With a single door, straight to it.
 */
export function DoorEventList() {
  const router = useRouter();
  // Read once: a new router object must not read the doors again
  const go = useRef(router.replace);
  go.current = router.replace;
  const [events, setEvents] = useState<DoorEvent[] | null>(null);
  const [live, setLive] = useState<Record<string, Live>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ticketsApi
      .listDoorEvents()
      .then((rows) => {
        if (cancelled) return;
        if (rows.length === 1) {
          go.current(eventDoorHref(rows[0].id));
          return;
        }
        setEvents(rows);
        for (const event of rows.filter((row) => runsNow(row))) {
          liveDoor(event)
            .then((found) => {
              if (!cancelled) setLive((current) => ({ ...current, [event.id]: found }));
            })
            .catch(() => undefined);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(coreProblemMessage(err, 'Etkinlikler yüklenemedi'));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Kapı" />
        <EmptyState kind="failed" title={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }
  if (!events) return <PageSkeleton variant="list" />;

  const now = events.filter((event) => runsNow(event));
  const later = events
    .filter((event) => !runsNow(event) && !hasEnded(event))
    .sort((a, b) => (a.startDate ?? '9').localeCompare(b.startDate ?? '9'));
  // Over, but still the person's door (a late entry): last, the latest first
  const past = events
    .filter((event) => !runsNow(event) && hasEnded(event))
    .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));

  const doorRow = (event: DoorEvent) => (
    <li key={event.id}>
      <Link
        href={eventDoorHref(event.id)}
        className="hover:bg-accent flex min-h-12 items-center gap-3 px-3 py-2.5"
      >
        <DoorOpen className="text-subtle-foreground size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="text-foreground block truncate text-sm font-medium">{event.name}</span>
          <span className={cn('text-subtle-foreground block truncate', TEXT_SECONDARY)}>
            {when(event)}
          </span>
        </span>
      </Link>
    </li>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Kapı" />
      {!events.length ? (
        <EmptyState kind="first-use" title="Kapı görevin olan etkinlik yok" />
      ) : null}
      {now.length ? (
        <section aria-label="Şimdi" className="space-y-2">
          <SectionHeading title="Şimdi" />
          <div className="space-y-3">
            {now.map((event) => (
              <NowCard key={event.id} event={event} live={live[event.id]} />
            ))}
          </div>
        </section>
      ) : null}
      {later.length ? (
        <section aria-label="Sıradaki" className="space-y-2">
          <SectionHeading title="Sıradaki" />
          <ul className="border-border-subtle bg-card divide-border-subtle divide-y overflow-hidden rounded-lg border">
            {later.map(doorRow)}
          </ul>
        </section>
      ) : null}
      {past.length ? (
        <section aria-label="Geçmiş" className="space-y-2">
          <SectionHeading title="Geçmiş" />
          <ul className="border-border-subtle bg-card divide-border-subtle divide-y overflow-hidden rounded-lg border">
            {past.map(doorRow)}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
