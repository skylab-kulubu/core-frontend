import { getInclusiveLocalCalendarDates } from '@/lib/utils/eventCalendar';
import { localDateKey, type DatedEvent } from '@/lib/events-view';

/** One week of a month view, Monday first; days outside the month are kept, marked. */
export type CalendarWeek = Array<{ date: Date; key: string; inMonth: boolean }>;

/** The weeks a month spans, each seven days from Monday, with the neighbours' days filled in. */
export function monthWeeks(year: number, month: number): CalendarWeek[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((lead + days) / 7) * 7;
  const weeks: CalendarWeek[] = [];
  for (let i = 0; i < cells; i += 1) {
    const date = new Date(year, month, 1 - lead + i);
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1].push({
      date,
      key: localDateKey(date),
      inMonth: date.getMonth() === month,
    });
  }
  return weeks;
}

/**
 * An Event's bar in one week (Outlook's month view): from its first day in the week for
 * `span` days, in a lane under the day numbers; whether it runs on before or after the week.
 */
export type CalendarBar<T> = {
  event: T;
  start: number;
  span: number;
  lane: number;
  before: boolean;
  after: boolean;
};

/**
 * Lays the week's Events out as bars, longest and earliest first so a long one keeps
 * one lane across the week; at most `lanes` lanes, the rest counted per day.
 */
export function weekBars<T extends DatedEvent>(
  events: readonly T[],
  week: CalendarWeek,
  lanes = 3,
): { bars: CalendarBar<T>[]; hidden: number[] } {
  const keys = week.map((day) => day.key);
  const placed = events
    .map((event) => {
      const days = getInclusiveLocalCalendarDates(event.startDate, event.endDate).map(localDateKey);
      const cols = keys.map((key, i) => (days.includes(key) ? i : -1)).filter((i) => i >= 0);
      if (!cols.length) return null;
      return {
        event,
        start: cols[0],
        span: cols[cols.length - 1] - cols[0] + 1,
        before: days[0] < keys[0],
        after: days[days.length - 1] > keys[6],
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort(
      (a, b) =>
        b.span - a.span || a.start - b.start || a.event.name.localeCompare(b.event.name, 'tr'),
    );
  const taken: boolean[][] = [];
  const bars: CalendarBar<T>[] = [];
  const hidden = Array<number>(7).fill(0);
  for (const row of placed) {
    let lane = 0;
    while (lane < lanes) {
      const used = taken[lane] ?? (taken[lane] = Array<boolean>(7).fill(false));
      if (!used.slice(row.start, row.start + row.span).some(Boolean)) break;
      lane += 1;
    }
    if (lane >= lanes) {
      for (let i = row.start; i < row.start + row.span; i += 1) hidden[i] += 1;
      continue;
    }
    for (let i = row.start; i < row.start + row.span; i += 1) taken[lane][i] = true;
    bars.push({ ...row, lane });
  }
  return { bars, hidden };
}

/**
 * The month as an agenda (a phone's calendar): each day that has an Event, in order, with the
 * Events that run on it; one that runs over several days is listed on each.
 */
export function monthAgenda<T extends DatedEvent>(
  events: readonly T[],
  year: number,
  month: number,
): Array<{ key: string; date: Date; events: T[] }> {
  const days = new Map<string, { key: string; date: Date; events: T[] }>();
  for (const event of events) {
    for (const day of getInclusiveLocalCalendarDates(event.startDate, event.endDate)) {
      if (day.getFullYear() !== year || day.getMonth() !== month) continue;
      const key = localDateKey(day);
      const row = days.get(key) ?? { key, date: day, events: [] };
      row.events.push(event);
      days.set(key, row);
    }
  }
  return [...days.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
}
