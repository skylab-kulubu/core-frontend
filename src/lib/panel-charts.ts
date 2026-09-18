import type { NamedCount } from './ozet-stats';

export function ticketMix(tickets: ReadonlyArray<{ ticketType: string }>): NamedCount[] {
  let guest = 0;
  let member = 0;
  for (const row of tickets) {
    if (row.ticketType === 'REGISTERED') member += 1;
    else guest += 1;
  }
  return [
    { label: 'Misafir', count: guest },
    { label: 'Üye', count: member },
  ];
}

export function ticketCheckInMix(
  tickets: ReadonlyArray<{ checkIns?: ReadonlyArray<unknown> }>,
): NamedCount[] {
  let checkedIn = 0;
  let registered = 0;
  for (const row of tickets) {
    if ((row.checkIns?.length ?? 0) > 0) checkedIn += 1;
    else registered += 1;
  }
  return [
    { label: 'Giriş yaptı', count: checkedIn },
    { label: 'Kayıtlı', count: registered },
  ];
}

export function topClickUrls(
  urls: ReadonlyArray<{ alias: string; clickCount: number }>,
  limit = 6,
): NamedCount[] {
  return [...urls]
    .filter((row) => row.clickCount > 0)
    .sort((a, b) => b.clickCount - a.clickCount || a.alias.localeCompare(b.alias, 'tr'))
    .slice(0, limit)
    .map((row) => ({ label: row.alias, count: row.clickCount }));
}

export function upcomingEvents<T extends { startDate?: string }>(
  events: readonly T[],
  now = new Date(),
  limit = 5,
): T[] {
  const ts = now.getTime();
  return [...events]
    .filter((event) => {
      if (!event.startDate) return false;
      const start = Date.parse(event.startDate);
      return !Number.isNaN(start) && start > ts;
    })
    .sort((a, b) => Date.parse(a.startDate ?? '') - Date.parse(b.startDate ?? ''))
    .slice(0, limit);
}

export function mixPercents(rows: readonly NamedCount[]): Array<NamedCount & { percent: number }> {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (total === 0) return rows.map((row) => ({ ...row, percent: 0 }));
  const raw = rows.map((row) => ({
    ...row,
    percent: (row.count / total) * 100,
  }));
  const rounded = raw.map((row) => ({ ...row, percent: Math.floor(row.percent) }));
  let remainder = 100 - rounded.reduce((sum, row) => sum + row.percent, 0);
  const order = raw
    .map((row, index) => ({ index, frac: row.percent - Math.floor(row.percent) }))
    .sort((a, b) => b.frac - a.frac);
  for (const item of order) {
    if (remainder <= 0) break;
    rounded[item.index].percent += 1;
    remainder -= 1;
  }
  return rounded;
}
