import type { CoreEvent } from '@/lib/api/events';
import type { Ticket } from '@/lib/api/tickets';

const DAY = 24 * 60 * 60 * 1000;

export type FeaturedEvent = { event: CoreEvent; live: boolean };

function span(event: CoreEvent): { start: number; end: number } | null {
  const start = Date.parse(event.startDate ?? '');
  if (Number.isNaN(start)) return null;
  const end = Date.parse(event.endDate ?? '');
  // Without an end date an event counts as running for the rest of its day
  return { start, end: Number.isNaN(end) ? start + 12 * 60 * 60 * 1000 : end };
}

/** The event running now, or else the next one to start. */
export function featuredEvent(
  events: readonly CoreEvent[],
  now = new Date(),
): FeaturedEvent | null {
  const ts = now.getTime();
  const timed = events
    .map((event) => ({ event, span: span(event) }))
    .filter((row): row is { event: CoreEvent; span: { start: number; end: number } } =>
      Boolean(row.span),
    );
  const live = timed
    .filter(({ span: s }) => s.start <= ts && ts <= s.end)
    .sort((a, b) => a.span.start - b.span.start)[0];
  if (live) return { event: live.event, live: true };
  const next = timed
    .filter(({ span: s }) => s.start > ts)
    .sort((a, b) => a.span.start - b.span.start)[0];
  return next ? { event: next.event, live: false } : null;
}

/** Applications per day for the last `days` days, oldest first. */
export function applicationsByDay(
  tickets: readonly Pick<Ticket, 'createdAt'>[],
  days = 14,
  now = new Date(),
): number[] {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const counts = Array.from({ length: days }, () => 0);
  for (const ticket of tickets) {
    const at = Date.parse(ticket.createdAt);
    if (Number.isNaN(at)) continue;
    const back = Math.floor((end.getTime() - at) / DAY);
    if (back >= 0 && back < days) counts[days - 1 - back] += 1;
  }
  return counts;
}

export type Attention = {
  id: string;
  eventId: string;
  eventName: string;
  /** Everything missing for the event, most pressing first. */
  messages: string[];
  /** Warning when something blocks applications; neutral for polish. */
  tone: 'warning' | 'neutral';
};

/**
 * What needs doing for the events of the next 30 days, from the fields the
 * events carry: no application form, nearly full, no cover image.
 */
export function attentionItems(
  events: readonly CoreEvent[],
  ticketsByEvent: ReadonlyMap<string, readonly Ticket[]>,
  now = new Date(),
): Attention[] {
  const ts = now.getTime();
  const items: Attention[] = [];
  const soon = events
    .map((event) => ({ event, start: Date.parse(event.startDate ?? '') }))
    .filter(({ start }) => !Number.isNaN(start) && start > ts && start - ts <= 30 * DAY)
    .sort((a, b) => a.start - b.start);
  for (const { event } of soon) {
    const warnings: string[] = [];
    const notes: string[] = [];
    if (!event.formUrl && !event.extraFormUrls?.length) warnings.push('Başvuru formu bağlanmamış');
    const count = ticketsByEvent.get(event.id)?.length ?? 0;
    if (event.capacity > 0 && count / event.capacity >= 0.9) {
      const share = Math.min(100, Math.round((count / event.capacity) * 100));
      warnings.push(`Kontenjanın %${share}'i dolu`);
    }
    if (!event.coverImageUrl && !event.coverImageId) notes.push('Kapak görseli yok');
    if (warnings.length || notes.length) {
      items.push({
        id: event.id,
        eventId: event.id,
        eventName: event.name,
        messages: [...warnings, ...notes],
        tone: warnings.length ? 'warning' : 'neutral',
      });
    }
  }
  return items;
}

/** How many of an event's applicants have come through the door. */
export function checkedIn(tickets: readonly Ticket[]): number {
  return tickets.filter((ticket) => (ticket.checkIns?.length ?? 0) > 0).length;
}
