import type { DayCount, EventStat, MonthCount } from '@/lib/api/dashboard';

const DAY = 24 * 60 * 60 * 1000;

const startOf = (stat: EventStat) => Date.parse(stat.startDate ?? '');

/** Events still to start, soonest first. */
export function upcomingStats(stats: readonly EventStat[], now = new Date()): EventStat[] {
  const ts = now.getTime();
  return stats
    .filter((stat) => !stat.live && startOf(stat) > ts)
    .sort((a, b) => startOf(a) - startOf(b));
}

/** The event running now, or else the next one to start. */
export function featuredEvent(stats: readonly EventStat[], now = new Date()): EventStat | null {
  return stats.find((stat) => stat.live) ?? upcomingStats(stats, now)[0] ?? null;
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

/** What needs doing for the events of the next 30 days: no form, nearly full, no cover image. */
export function attentionItems(stats: readonly EventStat[], now = new Date()): Attention[] {
  const ts = now.getTime();
  const items: Attention[] = [];
  for (const stat of upcomingStats(stats, now)) {
    if (startOf(stat) - ts > 30 * DAY) continue;
    const warnings: string[] = [];
    const notes: string[] = [];
    if (!stat.hasApplicationForm) warnings.push('Başvuru formu bağlanmamış');
    if (stat.capacity > 0 && stat.applications / stat.capacity >= 0.9) {
      const share = Math.min(100, Math.round((stat.applications / stat.capacity) * 100));
      warnings.push(`Kontenjanın %${share}'i dolu`);
    }
    if (!stat.hasCoverImage) notes.push('Kapak görseli yok');
    if (warnings.length || notes.length) {
      items.push({
        id: stat.id,
        eventId: stat.id,
        eventName: stat.name,
        messages: [...warnings, ...notes],
        tone: warnings.length ? 'warning' : 'neutral',
      });
    }
  }
  return items;
}

/** "Eki", "Kas": a 'YYYY-MM' month as a short Turkish label. */
export function monthLabel(month: string): string {
  const [year, index] = month.split('-').map(Number);
  if (!year || !index) return month;
  return new Date(year, index - 1, 1).toLocaleDateString('tr-TR', { month: 'short' });
}

export function monthCounts(months: readonly MonthCount[]): { label: string; count: number }[] {
  return months.map((row) => ({ label: monthLabel(row.month), count: row.count }));
}

export type BusiestDay = { date: string; count: number; eventName?: string };

/**
 * The day with the most applications in the window and, when it falls within
 * the last 14 days (all that each event carries), the event that took most of them.
 */
export function busiestDay(
  daily: readonly DayCount[],
  stats: readonly EventStat[],
): BusiestDay | null {
  let best = -1;
  daily.forEach((day, index) => {
    if (day.count > 0 && (best < 0 || day.count >= daily[best].count)) best = index;
  });
  if (best < 0) return null;
  const { date, count } = daily[best];
  const daysAgo = daily.length - 1 - best;
  let eventName: string | undefined;
  let top = 0;
  for (const stat of stats) {
    const value = stat.dailyApplications[stat.dailyApplications.length - 1 - daysAgo] ?? 0;
    if (daysAgo < stat.dailyApplications.length && value > top) {
      top = value;
      eventName = stat.name;
    }
  }
  return { date, count, eventName };
}
