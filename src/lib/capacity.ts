import type { Ticket } from '@/lib/api/tickets';

/**
 * An Event's capacity and waiting list as the panel says them (core
 * docs/event-capacity.md): `capacity` 0 is no bound; only active Tickets
 * count; the waiting list is served longest waiting first.
 */

/** "48/50" while the Event has a capacity, null without one. */
export function capacityFigure(active: number, capacity: number | undefined): string | null {
  return capacity && capacity > 0 ? `${active}/${capacity}` : null;
}

/** Whether the active Tickets fill the capacity, so one more goes past it. */
export function capacityFull(active: number, capacity: number | undefined): boolean {
  return Boolean(capacity && capacity > 0 && active >= capacity);
}

/** Whether a capacity set below the active Tickets (nobody is taken out; new ones wait). */
export function capacityBelowTickets(capacity: number, active: number | undefined): boolean {
  return capacity > 0 && active !== undefined && active > capacity;
}

/** "Kontenjan aşıldı (52/50)": said after a write core answered `overCapacity: true`. */
export function overCapacityLine(active: number, capacity: number | undefined): string {
  const figure = capacityFigure(active, capacity);
  return figure ? `Kontenjan aşıldı (${figure})` : 'Kontenjan aşıldı';
}

/** The waiting list in core's order: `waitlistedAt`, then when the Ticket was written. */
export function waitlistOrder<T extends Pick<Ticket, 'id' | 'waitlistedAt' | 'createdAt'>>(
  tickets: readonly T[],
): T[] {
  const at = (iso: string | undefined) => (iso ? Date.parse(iso) || 0 : 0);
  return [...tickets].sort(
    (left, right) =>
      at(left.waitlistedAt ?? left.createdAt) - at(right.waitlistedAt ?? right.createdAt) ||
      at(left.createdAt) - at(right.createdAt) ||
      left.id.localeCompare(right.id),
  );
}

/** Each waiting Ticket's place in the list, from 1. */
export function waitlistPlaces(tickets: readonly Ticket[]): Map<string, number> {
  return new Map(waitlistOrder(tickets).map((ticket, index) => [ticket.id, index + 1]));
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long the Ticket has waited: "5 dk", "3 saat", "2 gün". */
export function waitedFor(since: string | undefined, now = Date.now()): string | null {
  const from = since ? Date.parse(since) : NaN;
  if (!Number.isFinite(from)) return null;
  const span = Math.max(0, now - from);
  if (span < HOUR) return `${Math.max(1, Math.floor(span / MINUTE))} dk`;
  if (span < DAY) return `${Math.floor(span / HOUR)} saat`;
  return `${Math.floor(span / DAY)} gün`;
}
