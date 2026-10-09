import type { CoreEvent } from '@/lib/api/events';
import type { Season } from '@/lib/api/seasons';

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

const time = (iso?: string) => (iso ? Date.parse(iso) : NaN);

/**
 * The season the dashboard shows: the one running now, or else the one that
 * ended last. Seasons without both dates cannot be drawn and are skipped.
 */
export function currentSeason(seasons: readonly Season[], now = new Date()): Season | null {
  const ts = now.getTime();
  const dated = seasons.filter(
    (season) => !Number.isNaN(time(season.startDate)) && !Number.isNaN(time(season.endDate)),
  );
  const running = dated.find(
    (season) => time(season.startDate) <= ts && ts <= time(season.endDate) + DAY,
  );
  if (running) return running;
  const ended = dated
    .filter((season) => time(season.endDate) < ts)
    .sort((a, b) => time(b.endDate) - time(a.endDate));
  return ended[0] ?? null;
}

export type WheelEvent = {
  id: string;
  name: string;
  ownerTeam: string;
  startDate: string;
  /** Week of the season the event starts in, from 0. */
  week: number;
  /** Events starting in the same week stack outwards: 0 is nearest the ring. */
  stack: number;
  past: boolean;
};

export type SeasonWheel = {
  /** Whole weeks the season spans, at least one. */
  weeks: number;
  /** Where today falls, in weeks from the start; past the end once it is over. */
  now: number;
  ended: boolean;
  months: { label: string; week: number }[];
  events: WheelEvent[];
};

/** Lays a season's dated events out on a ring of its weeks. */
export function seasonWheel(
  season: Season,
  events: readonly CoreEvent[],
  now = new Date(),
): SeasonWheel {
  const start = time(season.startDate);
  const end = time(season.endDate);
  const weeks = Math.max(1, Math.ceil((end - start + DAY) / WEEK));
  const weekOf = (ts: number) => Math.min(weeks - 1, Math.max(0, Math.floor((ts - start) / WEEK)));

  const months: { label: string; week: number }[] = [];
  const cursor = new Date(start);
  cursor.setDate(1);
  for (let guard = 0; guard < 24 && cursor.getTime() <= end; guard++) {
    // A month's label sits in the middle of the part of it inside the season
    const from = Math.max(cursor.getTime(), start);
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1).getTime();
    const to = Math.min(next, end + DAY);
    if (to - from >= 7 * DAY) {
      months.push({
        label: cursor.toLocaleDateString('tr-TR', { month: 'short' }),
        week: ((from + to) / 2 - start) / WEEK,
      });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const stacks = new Map<number, number>();
  const placed = events
    .filter((event) => {
      const ts = time(event.startDate);
      return !Number.isNaN(ts) && ts >= start - DAY && ts <= end + DAY;
    })
    .sort((a, b) => time(a.startDate) - time(b.startDate))
    .map((event) => {
      const ts = time(event.startDate);
      const week = weekOf(ts);
      const stack = stacks.get(week) ?? 0;
      stacks.set(week, stack + 1);
      return {
        id: event.id,
        name: event.name,
        ownerTeam: event.ownerTeam,
        startDate: event.startDate as string,
        week,
        stack,
        past: (time(event.endDate) || ts) < now.getTime(),
      };
    });

  return {
    weeks,
    now: (now.getTime() - start) / WEEK,
    ended: now.getTime() > end + DAY,
    months,
    events: placed,
  };
}
