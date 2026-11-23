import type { CoreEvent } from '@/lib/api/events';
import type { EventSession } from '@/lib/api/sessions';
import type { Ticket } from '@/lib/api/tickets';
import { publicShortUrl } from '@/lib/api/urls';
import { eventEditHref, eventTabHref } from '@/lib/event-workspace';
import { hasCheckIn } from '@/lib/roster-insights';
import { percentWithEnding } from '@/lib/text/turkish-number';

/** One thing an event needs before people can come: done or still to do, with where to do it. */
export type ReadinessItem = {
  /** 'date', 'place', 'cover', 'description', 'form', 'program', or a to-do's own key. */
  key: string;
  label: string;
  done: boolean;
  href: string;
};

/**
 * What the event has and lacks, in the order an organizer fills them: date and
 * place, cover and description, the application form and a programme. No limit
 * on places and no certificate are choices, not gaps: the essentials show them.
 */
export function eventReadiness(
  event: Pick<
    CoreEvent,
    'id' | 'startDate' | 'location' | 'coverImageUrl' | 'description' | 'formUrl'
  >,
  sessionCount: number,
): ReadinessItem[] {
  const edit = (section: string) => `${eventEditHref(event.id)}#${section}`;
  return [
    { key: 'date', label: 'Tarih', done: Boolean(event.startDate), href: edit('zaman') },
    { key: 'place', label: 'Yer', done: Boolean(event.location?.trim()), href: edit('zaman') },
    { key: 'cover', label: 'Kapak', done: Boolean(event.coverImageUrl), href: edit('temel') },
    {
      key: 'description',
      label: 'Açıklama',
      done: Boolean(event.description?.trim()),
      href: edit('temel'),
    },
    { key: 'form', label: 'Başvuru formu', done: Boolean(event.formUrl), href: edit('basvuru') },
    {
      key: 'program',
      label: 'Program',
      done: sessionCount > 0,
      href: eventTabHref(event.id, 'program'),
    },
  ];
}

/** The session running at `now` and the next one to start, among those not cancelled. */
export function sessionNowAndNext(
  sessions: readonly EventSession[],
  now = new Date(),
): { current: EventSession | null; next: EventSession | null } {
  const at = now.getTime();
  const timed = sessions
    .filter((session) => !session.cancelled && session.startTime)
    .map((session) => ({
      session,
      start: Date.parse(session.startTime as string),
      end: session.endTime ? Date.parse(session.endTime) : Number.NaN,
    }))
    .filter((row) => Number.isFinite(row.start))
    .sort((a, b) => a.start - b.start);
  // The one that started last wins when sessions overlap (a talk inside a long work block)
  const running = timed.filter(
    (row) => row.start <= at && (Number.isFinite(row.end) ? at < row.end : false),
  );
  const current = running.length ? running[running.length - 1].session : null;
  const next = timed.find((row) => row.start > at)?.session ?? null;
  return { current, next };
}

/** "09:00–10:00" in Istanbul time; the start alone when there is no end. */
export function sessionClock(session: Pick<EventSession, 'startTime' | 'endTime'>): string {
  const clock = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
  });
  const start = session.startTime ? Date.parse(session.startTime) : Number.NaN;
  if (!Number.isFinite(start)) return '';
  const end = session.endTime ? Date.parse(session.endTime) : Number.NaN;
  return Number.isFinite(end)
    ? `${clock.format(new Date(start))}–${clock.format(new Date(end))}`
    : clock.format(new Date(start));
}

/** How many entered each session, from the registrations' check-ins. */
export function checkInsBySession(
  tickets: readonly Pick<Ticket, 'checkIns'>[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ticket of tickets) {
    for (const sessionId of new Set((ticket.checkIns ?? []).map((row) => row.sessionId))) {
      counts.set(sessionId, (counts.get(sessionId) ?? 0) + 1);
    }
  }
  return counts;
}

/** The latest registrations first. */
export function latestRegistrations<T extends Pick<Ticket, 'createdAt'>>(
  tickets: readonly T[],
  count = 5,
): T[] {
  return [...tickets]
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))
    .slice(0, count);
}

/** Registrations against the capacity; null when the event has none (no limit). */
export function capacityFill(
  registered: number,
  capacity: number,
): { ratio: number; left: number } | null {
  if (!(capacity > 0)) return null;
  return { ratio: registered / capacity, left: Math.max(0, capacity - registered) };
}

/** How many of the registrations came in. */
export function checkedInCount(tickets: readonly Pick<Ticket, 'checkIns'>[]): number {
  return tickets.filter(hasCheckIn).length;
}

/** A link people are sent to: its name, the address to show and copy, and its short-link name. */
export type ShareLink = { key: string; label: string; url: string; alias?: string };

/** The event's links to hand out: its application form, extra forms and feedback form. */
export function eventShareLinks(
  event: Pick<
    CoreEvent,
    'formUrl' | 'formAlias' | 'extraFormUrls' | 'feedbackFormUrl' | 'feedbackFormAlias'
  >,
): ShareLink[] {
  const link = (key: string, label: string, url?: string, alias?: string): ShareLink[] =>
    url || alias
      ? [{ key, label, url: alias ? publicShortUrl(alias) : (url as string), alias }]
      : [];
  return [
    ...link('form', 'Başvuru formu', event.formUrl, event.formAlias),
    ...(event.extraFormUrls ?? []).flatMap((form, index) =>
      link(`extra-${index}`, form.label || 'Ek form', form.url, form.alias),
    ),
    ...link('feedback', 'Geri bildirim formu', event.feedbackFormUrl, event.feedbackFormAlias),
  ];
}

/** Up to two initials of the event's name, for a cover's place when it has none. */
export function eventInitials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const letters = words
    .filter((word) => !/^\d+$/.test(word))
    .slice(0, 2)
    .map((word) => word[0]);
  return (letters.length ? letters.join('') : (words[0]?.slice(0, 2) ?? '')).toLocaleUpperCase(
    'tr-TR',
  );
}

/**
 * The certificate rule as the edit page names it: "Yok", "En az bir oturum",
 * "En az 6 oturum", "Oturumların %75'i" (the count rule's default, or an older ratio).
 */
export function certificateRuleLabel(
  event: Pick<CoreEvent, 'attendanceRule' | 'attendanceRatio' | 'attendanceMinCount'>,
): string {
  if (event.attendanceRule === 'once') return 'En az bir oturum';
  if (event.attendanceRule === 'count') {
    return event.attendanceMinCount
      ? `En az ${event.attendanceMinCount} oturum`
      : `Oturumların ${percentWithEnding(75)}`;
  }
  if (event.attendanceRule === 'ratio') {
    const ratio = event.attendanceRatio ?? 0.75;
    return `Oturumların ${percentWithEnding(ratio * 100)}`;
  }
  return 'Yok';
}

const dayAndClock = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const clockOnly = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  hour: '2-digit',
  minute: '2-digit',
});
const dayOnly = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * "22 Kasım 2026 Paz 09:00 – 23 Kasım 2026 Pzt 18:00"; the end's clock alone on the same day;
 * empty without a start.
 */
export function eventWhenLong(event: Pick<CoreEvent, 'startDate' | 'endDate'>): string {
  const start = event.startDate ? new Date(event.startDate) : null;
  if (!start || Number.isNaN(start.getTime())) return '';
  const end = event.endDate ? new Date(event.endDate) : null;
  if (!end || Number.isNaN(end.getTime())) return dayAndClock.format(start);
  const sameDay = dayOnly.format(start) === dayOnly.format(end);
  return `${dayAndClock.format(start)} – ${sameDay ? clockOnly.format(end) : dayAndClock.format(end)}`;
}
