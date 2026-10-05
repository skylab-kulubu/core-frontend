import { CORE_API_URL, coreFetch } from './core';
import { qrLogoQuery } from '@/lib/qr-url';

export type ShortUrl = {
  id: string;
  alias: string;
  url: string;
  clickCount: number;
  createdBy?: string;
  /** Set on a Form link: the link belongs to that Form. */
  formId?: string | null;
  /** Set while an Event names the link's Form; the Event then decides its alias. */
  eventId?: string | null;
  label?: string;
  disabledAt?: string;
  disabledBy?: string;
  createdAt: string;
  updatedAt: string;
};

/** Who manages a Short link; also the values of the list endpoints' `?source=`. */
export type LinkKind = 'personal' | 'form' | 'event';

/** A list filter: every link, or one kind. */
export type LinkKindFilter = 'all' | LinkKind;

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

/** The hit's utm source (instagram, qr…), or undefined when it carried none. */
export function hitSource(hit: Pick<ShortUrlHit, 'utm'>): string | undefined {
  return hit.utm?.source?.trim() || undefined;
}

export function hitWhen(hit: Pick<ShortUrlHit, 'createdAt'>): string {
  return hit.createdAt;
}

export function asHitList(rows: ShortUrlHit[] | null | undefined): ShortUrlHit[] {
  return Array.isArray(rows) ? rows : [];
}

/** The list endpoints' kind filter; Tümü asks for every link as before. */
function sourceQuery(kind: LinkKindFilter): string {
  return kind === 'all' ? '' : `?source=${kind}`;
}

export const urlsApi = {
  listMine: (kind: LinkKindFilter = 'all') => coreFetch<ShortUrl[]>(`/v1/urls${sourceQuery(kind)}`),
  listAll: (kind: LinkKindFilter = 'all') =>
    coreFetch<ShortUrl[]>(`/v1/urls/all${sourceQuery(kind)}`),
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
