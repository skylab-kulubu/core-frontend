import { CORE_API_URL, coreFetch } from './core';
import { qrLogoQuery } from '@/lib/qr-url';

export type ShortUrl = {
  id: string;
  alias: string;
  url: string;
  clickCount: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
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
  userId?: string;
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

export function hitWhen(hit: Pick<ShortUrlHit, 'createdAt'>): string {
  return hit.createdAt;
}

export function asHitList(rows: ShortUrlHit[] | null | undefined): ShortUrlHit[] {
  return Array.isArray(rows) ? rows : [];
}

export const urlsApi = {
  listMine: () => coreFetch<ShortUrl[]>('/v1/urls'),
  listAll: () => coreFetch<ShortUrl[]>('/v1/urls/all'),
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
