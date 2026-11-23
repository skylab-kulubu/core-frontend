import { coreProblemMessage } from '@/lib/core-problems';
import { bearer, ProblemError, problemFromResponse } from './core';

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
  createdAt?: string;
  updatedAt?: string;
  /**
   * The caller's own autosaved, unpublished changes to this item (inscribed keeps one per
   * editor, in Redis); absent when there are none.
   */
  draftData?: Partial<NewsData>;
  isArchived?: boolean;
  archivedAt?: string;
};

/**
 * Something the editor may bring into being: on News, the caller's one draft of an item
 * not created yet (`origin: "pending"`). It has no slug, id or version.
 */
export type NewsVirtualItem = {
  origin: 'pending' | 'derived';
  canEdit?: boolean;
  slug?: string;
  data: Partial<NewsData>;
  draftData?: Partial<NewsData> | null;
  updatedAt?: string;
};

export type NewsPage = {
  items: NewsItem[];
  total: number;
  offset: number;
  limit: number;
  /** Only for an editor: the caller's draft of a new item, whatever the page. */
  virtualItems?: NewsVirtualItem[];
};

/** What inscribed answers a delete with: the item is archived, not erased. */
export type NewsArchived = {
  collectionKey: string;
  slug: string;
  version: number;
  references: number;
};

/** inscribed collection keys are lowercase; `News` answers 404. */
const NEWS_COLLECTION = '/cms/collections/news';

export function cmsBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_CMS_URL || 'http://localhost:5000').replace(/\/+$/, '');
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
  remove: (slug: string, version: number, token?: string | null) =>
    cmsFetch<NewsArchived>(`${newsPath(slug)}?version=${version}`, { method: 'DELETE' }, token),
  /** Brings an archived item back, at the version it was archived with. */
  restore: (slug: string, version: number, token?: string | null) =>
    cmsFetch<NewsItem>(`${newsPath(slug)}/restore?version=${version}`, { method: 'POST' }, token),
  /** Autosaves the caller's draft of an item; only they see it, until they publish. */
  saveDraft: (slug: string, data: Partial<NewsData>, token?: string | null) =>
    cmsFetch<void>(
      `${newsPath(slug)}/draft`,
      { method: 'PUT', body: JSON.stringify({ data }) },
      token,
    ),
  /** Drops the caller's draft of an item: the published text stands. */
  discardDraft: (slug: string, token?: string | null) =>
    cmsFetch<void>(`${newsPath(slug)}/draft`, { method: 'DELETE' }, token),
  /** Autosaves the caller's one draft of an item not created yet. */
  savePendingDraft: (data: Partial<NewsData>, token?: string | null) =>
    cmsFetch<void>(
      `${NEWS_COLLECTION}/drafts`,
      { method: 'POST', body: JSON.stringify({ data }) },
      token,
    ),
  discardPendingDraft: (token?: string | null) =>
    cmsFetch<void>(`${NEWS_COLLECTION}/drafts`, { method: 'DELETE' }, token),
};

/** The caller's draft of a new item from a listing, or null. */
export function pendingNewsDraft(page: Pick<NewsPage, 'virtualItems'> | null | undefined) {
  const entry = page?.virtualItems?.find((row) => row.origin === 'pending');
  return entry?.draftData && Object.keys(entry.draftData).length ? entry : null;
}

/**
 * A Turkish sentence for a refused News write. inscribed answers 409 when the
 * version the editor read is no longer current, or with `reason: "archived"`
 * when the item was deleted meanwhile; anything else is the panel's shared
 * problem text (core-problems).
 */
export function newsProblemMessage(error: unknown, fallback: string): string {
  if (error instanceof ProblemError && error.status === 409) {
    if (error.fields.reason === 'archived') {
      return 'Bu duyuru bu arada başka biri tarafından silindi.';
    }
    if (error.fields.reason === 'moved') {
      return 'Bu duyurunun adresi değişti. Sayfayı yenileyip tekrar dene.';
    }
    return 'Bu duyuru sen açtıktan sonra başka biri tarafından değiştirildi. Sayfayı yenileyip tekrar dene.';
  }
  return coreProblemMessage(error, fallback);
}
