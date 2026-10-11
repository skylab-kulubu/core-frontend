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
