import type { EventStat, MonthCount } from '@/lib/api/dashboard';

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
