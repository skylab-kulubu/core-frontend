'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

/**
 * A list's place, kept in the address so a reload, the back button or a shared link
 * returns to it (Entra "Copy link to current view"): the search, the view chip, the
 * sort, the page and the row open beside the list.
 */
export type ListParams = {
  /** `q`: the search text. */
  q: string;
  /** `view`: the view chip ("all" by default). */
  view: string;
  /** `sort`: the sort key, or '' for the list's own order. */
  sort: string;
  /** `page`: from 1. */
  page: number;
  /** `panel`: the id of the row open in the side panel, or null. */
  panel: string | null;
};

const KEYS = ['q', 'view', 'sort', 'page', 'panel'] as const;

/** The address for `next`, leaving out every value that is its default; other params are kept. */
export function listParamsHref(
  pathname: string,
  current: URLSearchParams,
  next: ListParams,
  defaults: Pick<ListParams, 'view' | 'sort'>,
): string {
  const params = new URLSearchParams(current.toString());
  for (const key of KEYS) params.delete(key);
  if (next.q.trim()) params.set('q', next.q);
  if (next.view && next.view !== defaults.view) params.set('view', next.view);
  if (next.sort && next.sort !== defaults.sort) params.set('sort', next.sort);
  if (next.page > 1) params.set('page', String(next.page));
  if (next.panel) params.set('panel', next.panel);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** Reads the list's place from the address, falling back to the defaults. */
export function readListParams(
  params: Pick<URLSearchParams, 'get'>,
  defaults: Pick<ListParams, 'view' | 'sort'>,
): ListParams {
  const page = Number.parseInt(params.get('page') ?? '', 10);
  return {
    q: params.get('q') ?? '',
    view: params.get('view') || defaults.view,
    sort: params.get('sort') || defaults.sort,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    panel: params.get('panel') || null,
  };
}

/**
 * The list's place and a setter that writes it to the address without a scroll or a
 * new history entry. A new search, view or sort goes back to page 1 unless the change
 * names a page itself.
 */
export function useListParams({
  view: defaultView = 'all',
  sort: defaultSort = '',
}: { view?: string; sort?: string } = {}): [ListParams, (change: Partial<ListParams>) => void] {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const search = useSearchParams();
  const searchText = search?.toString() ?? '';
  const defaults = useMemo(
    () => ({ view: defaultView, sort: defaultSort }),
    [defaultView, defaultSort],
  );
  const state = useMemo(
    () => readListParams(new URLSearchParams(searchText), defaults),
    [searchText, defaults],
  );
  const set = useCallback(
    (change: Partial<ListParams>) => {
      const resets = 'q' in change || 'view' in change || 'sort' in change;
      const next: ListParams = {
        ...state,
        ...(resets ? { page: 1 } : {}),
        ...change,
      };
      router.replace(listParamsHref(pathname, new URLSearchParams(searchText), next, defaults), {
        scroll: false,
      });
    },
    [state, router, pathname, searchText, defaults],
  );
  return [state, set];
}
