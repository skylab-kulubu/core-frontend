import type { CoreEvent } from '@/lib/api/events';
import type { Group, Person } from '@/lib/api/identity';
import { displayPersonName } from '@/lib/chrome-role';

/** One result of Ctrl+K: a page or a record, opened by its address. */
export type SearchItem = Readonly<{
  id: string;
  label: string;
  group: string;
  href: string;
  /** Words besides the label that find it. */
  keywords?: string;
  /** A short note at the end of the row, such as an event's date. */
  note?: string;
}>;

/** Results per kind, as Shopify's admin search shows them. */
export const SEARCH_LIMIT = 7;
/** With nothing typed, the events to switch to: running first, then the next ones. */
const EVENTS_WITHOUT_QUERY = 5;
/** A person is searched from this many characters, as in every person picker. */
export const PERSON_SEARCH_MIN = 2;

/** Lowercase without accents and with ı as i, as skylcn-ui's palette compares. */
export function fold(text: string): string {
  return text.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');
}

function matches(query: string, ...fields: Array<string | undefined>): boolean {
  const q = fold(query.trim());
  return !q || fields.some((field) => field && fold(field).includes(q));
}

const DAY = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Europe/Istanbul',
});

function eventDay(event: CoreEvent): string | undefined {
  if (!event.startDate) return undefined;
  const date = new Date(event.startDate);
  return Number.isNaN(date.getTime()) ? undefined : DAY.format(date);
}

/**
 * Events by name, team or place. With nothing typed: the running ones, then
 * the next to start, so Ctrl+K also switches between events.
 */
export function eventSearchItems(
  events: readonly CoreEvent[],
  query: string,
  now: Date = new Date(),
): SearchItem[] {
  const q = query.trim();
  let rows: CoreEvent[];
  if (q) {
    rows = events.filter((event) => matches(q, event.name, event.ownerTeam, event.location));
  } else {
    const at = now.getTime();
    const time = (value?: string) => (value ? new Date(value).getTime() : Number.NaN);
    rows = events
      .filter((event) => event.status !== 'cancelled' && !(time(event.endDate) < at))
      .sort((a, b) => (time(a.startDate) || Infinity) - (time(b.startDate) || Infinity))
      .slice(0, EVENTS_WITHOUT_QUERY);
  }
  return rows.slice(0, SEARCH_LIMIT).map((event) => ({
    id: `event:${event.id}`,
    label: event.name,
    group: 'Etkinlikler',
    href: `/events/${encodeURIComponent(event.id)}`,
    keywords: [event.ownerTeam, event.location, q].filter(Boolean).join(' '),
    note: eventDay(event),
  }));
}

/** People core found for the query (core searches name and e-mail). */
export function personSearchItems(people: readonly Person[], query: string): SearchItem[] {
  return people.slice(0, SEARCH_LIMIT).map((person) => ({
    id: `person:${person.id}`,
    label: displayPersonName(person.firstName, person.lastName, person.username || person.email),
    group: 'Kişiler',
    href: `/users/${encodeURIComponent(person.id)}`,
    // core matched the query; the palette must not drop the row for a word it cannot see
    keywords: [person.email, person.username, query.trim()].filter(Boolean).join(' '),
  }));
}

/** Groups by name or path; only once something is typed. */
export function groupSearchItems(groups: readonly Group[], query: string): SearchItem[] {
  const q = query.trim();
  if (!q) return [];
  return groups
    .filter((group) => matches(q, group.name, group.path))
    .slice(0, SEARCH_LIMIT)
    .map((group) => ({
      id: `group:${group.id}`,
      label: group.name,
      group: 'Gruplar',
      href: `/groups/${encodeURIComponent(group.id)}`,
      keywords: [group.path, q].join(' '),
    }));
}
