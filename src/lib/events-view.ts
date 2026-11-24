import { pad2 } from '@/lib/date-picker';
import { getInclusiveLocalCalendarDates } from '@/lib/utils/eventCalendar';
import { externalRegistrationIssue } from '@/lib/external-registration';

export type DatedEvent = {
  id: string;
  name: string;
  location?: string;
  ownerTeam?: string;
  active?: boolean;
  status?: string;
  startDate?: string;
  endDate?: string;
};

export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function eventFormIssue(form: {
  name: string;
  location: string;
  startDate?: string;
  endDate?: string;
  externalRegistrationUrl?: string;
}): string | null {
  if (!form.name.trim()) return 'Etkinlik adı gerekli.';
  if (!form.location.trim()) return 'Konum gerekli.';
  const link = externalRegistrationIssue(form.externalRegistrationUrl);
  if (link) return link;
  const start = form.startDate?.trim() ? Date.parse(form.startDate) : NaN;
  const end = form.endDate?.trim() ? Date.parse(form.endDate) : NaN;
  if (form.startDate?.trim() && Number.isNaN(start)) return 'Başlangıç tarihi geçersiz.';
  if (form.endDate?.trim() && Number.isNaN(end)) return 'Bitiş tarihi geçersiz.';
  if (!Number.isNaN(start) && !Number.isNaN(end) && end < start) {
    return 'Bitiş, başlangıçtan önce olamaz.';
  }
  return null;
}

export function formatEventWhen(event: DatedEvent): string {
  if (!event.startDate) return '';
  const start = new Date(event.startDate);
  if (Number.isNaN(start.getTime())) return '';
  const end = event.endDate ? new Date(event.endDate) : start;
  const endSafe = Number.isNaN(end.getTime()) ? start : end;
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(endSafe.getFullYear(), endSafe.getMonth(), endSafe.getDate());
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  const startLabel = new Intl.DateTimeFormat('tr-TR', opts).format(startDay);
  if (startDay.getTime() === endDay.getTime()) return startLabel;
  return `${startLabel} – ${new Intl.DateTimeFormat('tr-TR', opts).format(endDay)}`;
}

export function eventListSubtitle(event: DatedEvent): string {
  const bits = [event.ownerTeam?.trim() || 'Genel'];
  if (event.location?.trim()) bits.push(event.location.trim());
  const when = formatEventWhen(event);
  if (when) bits.push(when);
  return bits.join(' · ');
}

/** How long an Event without an end date lasts after its start, as in core. */
const UNDATED_ENDS_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * When the Event ends, as core's `Event.EndsAt`: its end date, else a day
 * after its start; null when it has neither (it never ends).
 */
export function eventEndsAt(event: Pick<DatedEvent, 'startDate' | 'endDate'>): number | null {
  const end = event.endDate ? Date.parse(event.endDate) : NaN;
  if (!Number.isNaN(end)) return end;
  const start = event.startDate ? Date.parse(event.startDate) : NaN;
  if (!Number.isNaN(start)) return start + UNDATED_ENDS_AFTER_MS;
  return null;
}

/**
 * Whether core opens Attendance finalization (`Event.FinalizeOpenAt`): the
 * Event is published and has ended, or is undated.
 */
export function attendanceFinalizeOpen(
  event: Pick<DatedEvent, 'status' | 'startDate' | 'endDate'>,
  now = new Date(),
): boolean {
  if (event.status !== 'published') return false;
  const end = eventEndsAt(event);
  return end === null || end <= now.getTime();
}

function phase(event: DatedEvent, now: Date): 0 | 1 | 2 {
  if (!event.startDate || Number.isNaN(Date.parse(event.startDate))) return 1;
  const end = eventEndsAt(event);
  if (end !== null && end <= now.getTime()) return 2;
  return 0;
}

export function sortEventsForList<T extends DatedEvent>(
  events: readonly T[],
  now = new Date(),
): T[] {
  return [...events].sort((a, b) => {
    const pa = phase(a, now);
    const pb = phase(b, now);
    if (pa !== pb) return pa - pb;
    const sa = a.startDate ? Date.parse(a.startDate) : 0;
    const sb = b.startDate ? Date.parse(b.startDate) : 0;
    if (pa === 2) return sb - sa;
    if (pa === 0) return sa - sb;
    return a.name.localeCompare(b.name, 'tr');
  });
}

export function eventsOnDateKey<T extends DatedEvent>(events: readonly T[], key: string): T[] {
  return events.filter((event) =>
    getInclusiveLocalCalendarDates(event.startDate, event.endDate).some(
      (day) => localDateKey(day) === key,
    ),
  );
}

export function eventsByDateKey<T extends DatedEvent>(
  events: readonly T[],
  year: number,
  month: number,
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const event of events) {
    for (const day of getInclusiveLocalCalendarDates(event.startDate, event.endDate)) {
      if (day.getFullYear() !== year || day.getMonth() !== month) continue;
      const key = localDateKey(day);
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
  }
  return map;
}

export function undatedEvents<T extends DatedEvent>(events: readonly T[]): T[] {
  return events.filter(
    (event) => getInclusiveLocalCalendarDates(event.startDate, event.endDate).length === 0,
  );
}

/**
 * What a list or a header shows for an Event (SPEC §2.6): its stored status,
 * and for a published one where it stands in time by core's end rule.
 */
export type EventDisplayStatus = 'draft' | 'upcoming' | 'live' | 'ended' | 'undated' | 'cancelled';

export const EVENT_STATUS_LABELS: Record<EventDisplayStatus, string> = {
  draft: 'Taslak',
  upcoming: 'Yaklaşıyor',
  live: 'Sürüyor',
  ended: 'Bitti',
  undated: 'Tarihsiz',
  cancelled: 'İptal',
};

/** The stored status; an Event from an older core carries none and is published. */
export function eventStatusOf(
  event: Pick<DatedEvent, 'status'>,
): 'draft' | 'published' | 'cancelled' {
  if (event.status === 'draft' || event.status === 'cancelled') return event.status;
  return 'published';
}

export function eventDisplayStatus(
  event: Pick<DatedEvent, 'status' | 'startDate' | 'endDate'>,
  now = new Date(),
): EventDisplayStatus {
  const status = eventStatusOf(event);
  if (status !== 'published') return status;
  const start = event.startDate ? Date.parse(event.startDate) : NaN;
  if (Number.isNaN(start)) return 'undated';
  const end = eventEndsAt(event);
  if (end !== null && end <= now.getTime()) return 'ended';
  return start > now.getTime() ? 'upcoming' : 'live';
}

/** The list's status filter: Tümü · Taslak · Yaklaşan · Sürüyor · Geçmiş · İptal. */
export type EventStatusFilter = 'all' | 'draft' | 'upcoming' | 'live' | 'past' | 'cancelled';

export const EVENT_STATUS_FILTERS: ReadonlyArray<{ value: EventStatusFilter; label: string }> = [
  { value: 'all', label: 'Tümü' },
  { value: 'draft', label: 'Taslak' },
  { value: 'upcoming', label: 'Yaklaşan' },
  { value: 'live', label: 'Sürüyor' },
  { value: 'past', label: 'Geçmiş' },
  { value: 'cancelled', label: 'İptal' },
];

/** An undated published Event is in no slice but Tümü. */
const FILTER_OF: Record<EventDisplayStatus, EventStatusFilter | null> = {
  draft: 'draft',
  upcoming: 'upcoming',
  live: 'live',
  ended: 'past',
  undated: null,
  cancelled: 'cancelled',
};

/** The filter named in the address (`?status=`), Tümü for anything else. */
export function eventStatusFilterFrom(raw: string | null | undefined): EventStatusFilter {
  return EVENT_STATUS_FILTERS.some((row) => row.value === raw) ? (raw as EventStatusFilter) : 'all';
}

export function filterEventsByStatus<T extends DatedEvent>(
  events: readonly T[],
  filter: EventStatusFilter,
  now = new Date(),
): T[] {
  if (filter === 'all') return [...events];
  return events.filter((event) => FILTER_OF[eventDisplayStatus(event, now)] === filter);
}

export function countEventsByStatus(
  events: readonly DatedEvent[],
  now = new Date(),
): Record<EventStatusFilter, number> {
  const counts: Record<EventStatusFilter, number> = {
    all: events.length,
    draft: 0,
    upcoming: 0,
    live: 0,
    past: 0,
    cancelled: 0,
  };
  for (const event of events) {
    const slice = FILTER_OF[eventDisplayStatus(event, now)];
    if (slice) counts[slice] += 1;
  }
  return counts;
}

/** What the list warns about on an Event still to run: the first missing part names the line. */
export type EventGap = 'date' | 'place' | 'cover' | 'form';

const GAP_LABELS: Record<EventGap, string> = {
  date: 'Tarih',
  place: 'Yer',
  cover: 'Kapak',
  form: 'Başvuru formu',
};

/**
 * The parts a draft or an Event still to come lacks, in the order they are filled in;
 * none for an ended or cancelled one, where they no longer matter.
 */
export function eventGaps(
  event: Pick<DatedEvent, 'status' | 'startDate' | 'endDate' | 'location'> & {
    coverImageUrl?: string;
    formUrl?: string;
    extraFormUrls?: ReadonlyArray<unknown>;
  },
  now = new Date(),
): EventGap[] {
  const status = eventDisplayStatus(event, now);
  if (status === 'ended' || status === 'cancelled') return [];
  const gaps: EventGap[] = [];
  if (!event.startDate) gaps.push('date');
  if (!event.location?.trim()) gaps.push('place');
  if (!event.coverImageUrl) gaps.push('cover');
  if (!event.formUrl && !event.extraFormUrls?.length) gaps.push('form');
  return gaps;
}

/** "Kapak eksik", "Kapak, Yer eksik", "Kapak, Yer +1 eksik"; '' with none. */
export function eventGapLine(gaps: readonly EventGap[]): string {
  if (!gaps.length) return '';
  const named = gaps.slice(0, 2).map((gap, i) => {
    const label = GAP_LABELS[gap];
    return i === 0 ? label : label.toLocaleLowerCase('tr');
  });
  const more = gaps.length > 2 ? ` +${gaps.length - 2}` : '';
  return `${named.join(', ')}${more} eksik`;
}

/** The list's sorts: its own order (running and coming first), newest, name, registrations. */
export type EventSort = '' | 'newest' | 'name' | 'registrations';

export const EVENT_SORTS: ReadonlyArray<{ value: EventSort; label: string }> = [
  { value: '', label: 'Yakında olan' },
  { value: 'newest', label: 'En yeni tarih' },
  { value: 'name', label: 'Ada göre' },
  { value: 'registrations', label: 'En çok kayıt' },
];

export function eventSortFrom(raw: string | null | undefined): EventSort {
  return EVENT_SORTS.some((row) => row.value === raw) ? (raw as EventSort) : '';
}

export function sortEvents<T extends DatedEvent>(
  events: readonly T[],
  sort: EventSort,
  registrations: (event: T) => number = () => 0,
  now = new Date(),
): T[] {
  if (sort === '') return sortEventsForList(events, now);
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, 'tr');
  if (sort === 'name') return [...events].sort(byName);
  if (sort === 'registrations') {
    return [...events].sort((a, b) => registrations(b) - registrations(a) || byName(a, b));
  }
  // Newest start first, undated last
  const start = (event: T) => {
    const at = event.startDate ? Date.parse(event.startDate) : NaN;
    return Number.isNaN(at) ? -Infinity : at;
  };
  return [...events].sort((a, b) => start(b) - start(a) || byName(a, b));
}

/** A list cell's dates, short: "22–23 Kas 2026", "30 Kas – 2 Ara 2026", "3 Ara 2026"; '' undated. */
export function formatEventWhenShort(event: Pick<DatedEvent, 'startDate' | 'endDate'>): string {
  if (!event.startDate) return '';
  const start = new Date(event.startDate);
  if (Number.isNaN(start.getTime())) return '';
  const rawEnd = event.endDate ? new Date(event.endDate) : start;
  const end = Number.isNaN(rawEnd.getTime()) ? start : rawEnd;
  const day = (d: Date) => new Intl.DateTimeFormat('tr-TR', { day: 'numeric' }).format(d);
  const dayMonth = (d: Date) =>
    new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(d);
  const full = (d: Date) =>
    new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  const sameDay = localDateKey(start) === localDateKey(end);
  if (sameDay) return full(start);
  if (start.getFullYear() !== end.getFullYear()) return `${full(start)} – ${full(end)}`;
  if (start.getMonth() === end.getMonth()) return `${day(start)}–${full(end)}`;
  return `${dayMonth(start)} – ${full(end)}`;
}
