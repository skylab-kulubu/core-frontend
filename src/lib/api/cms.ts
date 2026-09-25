import { problemFromResponse } from './core';

export type NewsData = {
  title: string;
  summary?: string;
  body: string;
  heroImage?: string;
  tags?: string[];
  author?: string;
  featured?: boolean;
};

export type NewsItem = {
  id: string;
  collectionKey: string;
  slug: string;
  data: NewsData;
  version: number;
  canEdit?: boolean;
};

export type NewsPage = {
  items: NewsItem[];
  total: number;
  offset: number;
  limit: number;
};

const NEWS_COLLECTION = '/cms/collections/News';

export function cmsBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_CMS_URL || 'http://localhost:5000').replace(/\/+$/, '');
}

async function bearer(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const res = await fetch('/api/auth/token', { credentials: 'include' });
  if (!res.ok) return null;
  const body = (await res.json()) as { token?: string };
  return body.token ?? null;
}

export async function cmsFetch<T>(
  path: string,
  init: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const access = token === undefined ? await bearer() : token;
  const headers: Record<string, string> = {
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
  };
  if (access) headers.Authorization = `Bearer ${access}`;
  if (init.headers) {
    Object.assign(headers, init.headers as Record<string, string>);
  }
  const res = await fetch(`${cmsBaseUrl()}${path}`, { ...init, credentials: 'include', headers });
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  if (!res.ok) {
    throw problemFromResponse(res.status, text);
  }
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

function newsPath(slug?: string): string {
  if (!slug) return NEWS_COLLECTION;
  return `${NEWS_COLLECTION}/${encodeURIComponent(slug)}`;
}

export const newsApi = {
  list: (params?: { offset?: number; limit?: number }, token?: string | null) => {
    const query = new URLSearchParams();
    query.set('offset', String(params?.offset ?? 0));
    query.set('limit', String(params?.limit ?? 50));
    return cmsFetch<NewsPage>(`${NEWS_COLLECTION}?${query.toString()}`, {}, token);
  },
  get: (slug: string, token?: string | null) => cmsFetch<NewsItem>(newsPath(slug), {}, token),
  create: (data: NewsData, token?: string | null) =>
    cmsFetch<NewsItem>(NEWS_COLLECTION, { method: 'POST', body: JSON.stringify({ data }) }, token),
  update: (slug: string, data: NewsData, version: number, token?: string | null) =>
    cmsFetch<NewsItem>(
      newsPath(slug),
      { method: 'PUT', body: JSON.stringify({ data, version }) },
      token,
    ),
  remove: (slug: string, token?: string | null) =>
    cmsFetch<void>(newsPath(slug), { method: 'DELETE' }, token),
};
