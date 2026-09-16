import { CORE_API_URL, coreFetch } from './core';

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

export const SHORT_ORIGIN = (process.env.NEXT_PUBLIC_SHORT_ORIGIN || 'https://skyl.app').replace(
  /\/+$/,
  '',
);

export function publicShortUrl(alias: string): string {
  return `${SHORT_ORIGIN}/${alias}`;
}

export function shortQrUrl(alias: string): string {
  return `${CORE_API_URL}/v1/go/${encodeURIComponent(alias)}/qr`;
}

export const urlsApi = {
  listMine: () => coreFetch<ShortUrl[]>('/v1/urls'),
  listAll: () => coreFetch<ShortUrl[]>('/v1/urls/all'),
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
