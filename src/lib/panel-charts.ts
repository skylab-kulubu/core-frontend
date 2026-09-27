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
