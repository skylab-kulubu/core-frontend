const relative = new Intl.RelativeTimeFormat('tr-TR', { numeric: 'auto' });

/** "3 gün sonra", "2 saat önce": the distance to a moment in the nearest sensible unit. */
export function fromNow(iso: string, now = new Date()): string {
  const diff = Date.parse(iso) - now.getTime();
  const minutes = Math.round(diff / 60000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour');
  return relative.format(Math.round(hours / 24), 'day');
}

export function longDate(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}
