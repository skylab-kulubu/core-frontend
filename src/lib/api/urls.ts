import { CORE_API_URL, coreFetch } from './core';
import { qrLogoQuery } from '@/lib/qr-url';
import { sourceQuery, type SourceFilter } from '@/lib/short-links';

export type ShortUrl = {
  id: string;
  alias: string;
  url: string;
  clickCount: number;
  createdBy?: string;
  /** Set when a form owns the link; event links carry their form too. */
  formId?: string | null;
  /** Set when an event owns the link. */
  eventId?: string | null;
  label?: string;
  disabledAt?: string;
  disabledBy?: string;
  createdAt: string;
  updatedAt: string;
};

/** Core's answer to `GET /v1/urls/availability`; reason is invalid, reserved or taken. */
export type AliasAvailability = {
  alias: string;
  available: boolean;
  reason?: string;
};

export type ShortUrlBody = {
  url: string;
  alias?: string;
};

export type ShortUrlHit = {
  id: string;
  urlId: string;
  alias: string;
  createdAt: string;
  ip: string;
  userAgent: string;
  referer: string;
  utm?: ShortUrlUtm;
  userId?: string;
};

/** The hit's UTM tags; a channel suffix (/ig, /wa…) or a QR scan fills source. */
export type ShortUrlUtm = {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
};

export const SHORT_ORIGIN = (process.env.NEXT_PUBLIC_SHORT_ORIGIN || 'https://skyl.app').replace(
  /\/+$/,
  '',
);

export function publicShortUrl(alias: string): string {
  return `${SHORT_ORIGIN}/${alias}`;
}

export function shortQrPath(alias: string, opts?: { size?: number }): string {
  return `/v1/go/${encodeURIComponent(alias)}/qr${qrLogoQuery(opts)}`;
}

export function shortQrUrl(alias: string, opts?: { size?: number }): string {
  return `${CORE_API_URL}${shortQrPath(alias, opts)}`;
}

export function shortQrFileName(alias: string): string {
  return `skylapp-${alias}.png`;
}

export function hitUserLabel(hit: Pick<ShortUrlHit, 'userId'>): string {
  if (hit.userId?.trim()) return hit.userId;
  return '—';
}

/** The hit's utm source (instagram, qr…) as a subtitle prefix, or nothing without one. */
export function hitChannel(hit: Pick<ShortUrlHit, 'utm'>): string {
  const source = hit.utm?.source?.trim();
  return source ? `${source} · ` : '';
}

export function hitWhen(hit: Pick<ShortUrlHit, 'createdAt'>): string {
  return hit.createdAt;
}

export function asHitList(rows: ShortUrlHit[] | null | undefined): ShortUrlHit[] {
  return Array.isArray(rows) ? rows : [];
}

export const urlsApi = {
  listMine: (source: SourceFilter = 'all') =>
    coreFetch<ShortUrl[]>(`/v1/urls${sourceQuery(source)}`),
  listAll: (source: SourceFilter = 'all') =>
    coreFetch<ShortUrl[]>(`/v1/urls/all${sourceQuery(source)}`),
  availability: (alias: string) =>
    coreFetch<AliasAvailability>(`/v1/urls/availability?alias=${encodeURIComponent(alias)}`),
  listHits: (id: string) => coreFetch<ShortUrlHit[]>(`/v1/urls/${encodeURIComponent(id)}/hits`),
  create: (body: ShortUrlBody) =>
    coreFetch<ShortUrl>('/v1/urls', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: ShortUrlBody) =>
    coreFetch<ShortUrl>(`/v1/urls/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    coreFetch<void>(`/v1/urls/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
