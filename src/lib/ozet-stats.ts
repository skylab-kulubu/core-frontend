export type CountState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; count: number };

export type NamedCount = Readonly<{ label: string; count: number }>;

export function okCount(count: number): CountState {
  return { kind: 'ok', count };
}

export function errorCount(message: string): CountState {
  return { kind: 'error', message };
}

export function displayCount(state: CountState): string {
  if (state.kind === 'loading') return '--';
  if (state.kind === 'error') return 'Hata';
  if (state.count === 0) return 'Boş';
  return String(state.count);
}

export function sessionsByEvent(
  sessions: ReadonlyArray<{ eventName: string }>,
  limit = 6,
): NamedCount[] {
  const map = new Map<string, number>();
  for (const row of sessions) {
    const label = (row.eventName ?? '').trim() || 'Etkinlik';
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'tr'))
    .slice(0, limit);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function eventsByMonth(
  events: ReadonlyArray<{ startDate?: string }>,
  now = new Date(),
): NamedCount[] {
  const buckets: Array<{ key: string; label: string; count: number }> = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: monthKey(d),
      label: d.toLocaleDateString('tr-TR', { month: 'short' }),
      count: 0,
    });
  }
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  for (const event of events) {
    if (!event.startDate) continue;
    const parsed = new Date(event.startDate);
    if (Number.isNaN(parsed.getTime())) continue;
    const i = index.get(monthKey(parsed));
    if (i === undefined) continue;
    buckets[i].count += 1;
  }
  return buckets.map(({ label, count }) => ({ label, count }));
}

export function eventActivity(
  events: ReadonlyArray<{ active: boolean; startDate?: string }>,
  now = new Date(),
): NamedCount[] {
  const ts = now.getTime();
  let active = 0;
  let upcoming = 0;
  let past = 0;
  for (const event of events) {
    if (event.active) active += 1;
    if (!event.startDate) continue;
    const start = Date.parse(event.startDate);
    if (Number.isNaN(start)) continue;
    if (start > ts) upcoming += 1;
    else past += 1;
  }
  return [
    { label: 'Aktif', count: active },
    { label: 'Yaklaşan', count: upcoming },
    { label: 'Geçmiş', count: past },
  ];
}
