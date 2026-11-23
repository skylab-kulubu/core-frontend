import type { LinkKind, ShortUrl, ShortUrlStats } from '@/lib/api/urls';
import type { NamedCount } from '@/lib/ozet-stats';
import { linkKind } from '@/lib/short-links';

/** The list's views: whose links, or which kind among them. */
export type LinkView = 'mine' | 'all' | LinkKind;
export type LinkSort = 'new' | 'clicks' | 'alias';

export function asLinkView(raw: string, moderate: boolean): LinkView {
  if (raw === 'all' && moderate) return 'all';
  if (raw === 'personal' || raw === 'form' || raw === 'event') return raw;
  return 'mine';
}

export function asLinkSort(raw: string, moderate: boolean): LinkSort {
  if (raw === 'alias') return 'alias';
  if (raw === 'clicks' && moderate) return 'clicks';
  return 'new';
}

/**
 * The rows a view shows. A URL moderator reads every link, so "Benim" is their own among
 * them and the kinds narrow everyone's; anyone else holds only their own.
 */
export function linksInView(
  rows: readonly ShortUrl[],
  view: LinkView,
  userId: string | undefined,
): ShortUrl[] {
  switch (view) {
    case 'all':
      return [...rows];
    case 'mine':
      return rows.filter((row) => Boolean(userId) && row.createdBy === userId);
    default:
      return rows.filter((row) => linkKind(row) === view);
  }
}

export function sortLinks(rows: readonly ShortUrl[], sort: LinkSort): ShortUrl[] {
  const out = [...rows];
  switch (sort) {
    case 'alias':
      return out.sort((a, b) => a.alias.localeCompare(b.alias, 'tr'));
    case 'clicks':
      return out.sort(
        (a, b) => b.clickCount - a.clickCount || a.alias.localeCompare(b.alias, 'tr'),
      );
    default:
      return out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }
}

/** The target's site without "www.", for the line under a link; the address itself if unreadable. */
export function targetHost(target: string): string {
  try {
    return new URL(target).hostname.replace(/^www\./, '') || target;
  } catch {
    return target;
  }
}

/** The link clicked most, or null when none has a click. */
export function mostClicked(rows: readonly ShortUrl[]): ShortUrl | null {
  let best: ShortUrl | null = null;
  for (const row of rows) {
    if (row.clickCount > 0 && (!best || row.clickCount > best.clickCount)) best = row;
  }
  return best;
}

const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  email: 'E-posta',
  x: 'X',
  website: 'Web sitesi',
  qr: 'QR',
  other: 'Diğer',
  '': 'Etiketsiz',
};

const DEVICE_LABELS: Record<string, string> = {
  mobile: 'Telefon',
  tablet: 'Tablet',
  desktop: 'Bilgisayar',
  bot: 'Önizleme',
  unknown: 'Bilinmiyor',
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

export function referrerLabel(host: string): string {
  if (!host) return 'Doğrudan';
  if (host === 'other') return 'Diğer';
  return host;
}

export function deviceLabel(device: string): string {
  return DEVICE_LABELS[device] ?? device;
}

const DAY = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/** "23 Kas" for core's YYYY-MM-DD day (a calendar day, so read as UTC). */
export function dayLabel(day: string): string {
  const at = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(at.getTime()) ? day : DAY.format(at);
}

/** core's summary as the panel's charts draw it. */
export function statsCharts(stats: ShortUrlStats): {
  daily: NamedCount[];
  sources: NamedCount[];
  referrers: NamedCount[];
  devices: NamedCount[];
} {
  return {
    daily: (stats.daily ?? []).map((row) => ({ label: dayLabel(row.day), count: row.count })),
    sources: (stats.sources ?? []).map((row) => ({
      label: sourceLabel(row.source),
      count: row.count,
    })),
    referrers: (stats.referrers ?? []).map((row) => ({
      label: referrerLabel(row.name),
      count: row.count,
    })),
    devices: (stats.devices ?? []).map((row) => ({
      label: deviceLabel(row.name),
      count: row.count,
    })),
  };
}
