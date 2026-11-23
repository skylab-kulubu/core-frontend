import type { EventStat } from '@/lib/api/dashboard';
import type { CoreEvent } from '@/lib/api/events';
import type { Season } from '@/lib/api/seasons';
import type { NamedCount } from '@/lib/ozet-stats';

const DAY = 24 * 60 * 60 * 1000;
const ZONE = 'Europe/Istanbul';

const DATE = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: ZONE,
});

const time = (iso?: string) => (iso ? Date.parse(iso) : NaN);

/** "28 Eyl 2026 – 31 May 2027"; one side alone when the other is not set; '' when neither. */
export function seasonRange(season: Pick<Season, 'startDate' | 'endDate'>): string {
  const start = time(season.startDate);
  const end = time(season.endDate);
  const parts = [start, end].map((ts) => (Number.isNaN(ts) ? '' : DATE.format(ts)));
  if (!parts[0] && !parts[1]) return '';
  if (!parts[1]) return `${parts[0]} –`;
  if (!parts[0]) return `– ${parts[1]}`;
  return `${parts[0]} – ${parts[1]}`;
}

export type SeasonProgress =
  | { phase: 'undated' }
  | { phase: 'upcoming'; days: number; inDays: number }
  | { phase: 'running'; days: number; day: number; percent: number }
  | { phase: 'ended'; days: number };

/** Where today falls in the season: before it, which day of it, or after it. */
export function seasonProgress(
  season: Pick<Season, 'startDate' | 'endDate'>,
  now: Date,
): SeasonProgress {
  const start = time(season.startDate);
  const end = time(season.endDate);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return { phase: 'undated' };
  const days = Math.max(1, Math.ceil((end - start) / DAY));
  const at = now.getTime();
  if (at < start) return { phase: 'upcoming', days, inDays: Math.ceil((start - at) / DAY) };
  if (at > end) return { phase: 'ended', days };
  const day = Math.min(days, Math.floor((at - start) / DAY) + 1);
  return { phase: 'running', days, day, percent: Math.round(((at - start) / (end - start)) * 100) };
}

/** The progress in words: "57. gün / 246", "12 gün sonra başlar", "Bitti". */
export function progressText(progress: SeasonProgress): string {
  switch (progress.phase) {
    case 'running':
      return `${progress.day}. gün / ${progress.days}`;
    case 'upcoming':
      return `${progress.inDays} gün sonra başlar`;
    case 'ended':
      return 'Bitti';
    default:
      return 'Tarih yok';
  }
}

export type SeasonFigures = {
  events: number;
  /** Events over already. */
  past: number;
  /** null: core's figures could not be read (or the reader may not read them). */
  applications: number | null;
  attendees: number | null;
};

/** The season's counts: its events from the season's list, applications and entries from core's stats. */
export function seasonFigures(
  events: readonly Pick<CoreEvent, 'id' | 'endDate' | 'startDate'>[],
  stats: readonly Pick<EventStat, 'id' | 'applications' | 'checkedIn'>[] | null,
  now: Date,
): SeasonFigures {
  const ids = new Set(events.map((event) => event.id));
  const rows = stats ? stats.filter((row) => ids.has(row.id)) : null;
  const past = events.filter((event) => {
    const end = time(event.endDate ?? event.startDate);
    return !Number.isNaN(end) && end < now.getTime();
  }).length;
  return {
    events: events.length,
    past,
    applications: rows ? rows.reduce((sum, row) => sum + row.applications, 0) : null,
    attendees: rows ? rows.reduce((sum, row) => sum + row.checkedIn, 0) : null,
  };
}

const MONTH = new Intl.DateTimeFormat('tr-TR', { month: 'short', timeZone: ZONE });
const monthKey = (ts: number) =>
  new Date(ts).toLocaleDateString('en-CA', { timeZone: ZONE }).slice(0, 7);

/** Events per month across the season, every month of it shown, empty ones too. */
export function eventsByMonth(
  season: Pick<Season, 'startDate' | 'endDate'>,
  events: readonly Pick<CoreEvent, 'startDate'>[],
): NamedCount[] {
  const start = time(season.startDate);
  const end = time(season.endDate);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return [];
  const counts = new Map<string, number>();
  for (const event of events) {
    const ts = time(event.startDate);
    if (Number.isNaN(ts)) continue;
    counts.set(monthKey(ts), (counts.get(monthKey(ts)) ?? 0) + 1);
  }
  const rows: NamedCount[] = [];
  const cursor = new Date(monthKey(start) + '-15T12:00:00Z');
  for (let guard = 0; guard < 24; guard++) {
    const key = monthKey(cursor.getTime());
    if (key > monthKey(end)) break;
    rows.push({ label: MONTH.format(cursor), count: counts.get(key) ?? 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return rows;
}

/** The season page's sections, kept in the address as `?bolum=`. */
export type SeasonSection = 'genel' | 'etkinlikler' | 'ayarlar';

export function seasonSection(raw: string | null): SeasonSection {
  return raw === 'etkinlikler' || raw === 'ayarlar' ? raw : 'genel';
}

export function seasonHref(id: string, section: SeasonSection = 'genel'): string {
  const base = `/seasons/${encodeURIComponent(id)}`;
  return section === 'genel' ? base : `${base}?bolum=${section}`;
}
