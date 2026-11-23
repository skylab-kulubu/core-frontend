'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from './page-sizes';

export { DEFAULT_PAGE_SIZE, PAGE_SIZES };

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
  /** `size`: rows a page, one of PAGE_SIZES (25 by default). */
  size: number;
  /** `panel`: the id of the row open in the side panel, or null. */
  panel: string | null;
};

const KEYS = ['q', 'view', 'sort', 'page', 'size', 'panel'] as const;

function pageSize(value: string | null): number {
  const size = Number.parseInt(value ?? '', 10);
  return (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE;
}

/** The address for `next`, leaving out every value that is its default; other params are kept. */
export function listParamsHref(
  pathname: string,
  current: URLSearchParams,
  next: ListParams,
  defaults: Pick<ListParams, 'view' | 'sort'>,
): string {
  const params = new URLSearchParams(current.toString());
  for (const key of KEYS) params.delete(key);
  // Kept as typed: a box holding only spaces is not emptied under the reader
  if (next.q) params.set('q', next.q);
  if (next.view && next.view !== defaults.view) params.set('view', next.view);
  if (next.sort && next.sort !== defaults.sort) params.set('sort', next.sort);
  if (next.page > 1) params.set('page', String(next.page));
  if (next.size && next.size !== DEFAULT_PAGE_SIZE) params.set('size', String(next.size));
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
    size: pageSize(params.get('size')),
    panel: params.get('panel') || null,
  };
}

/** Marks a history entry this hook pushed to open a row's panel, so closing it goes back. */
const PANEL_ENTRY = 'skylabListPanel';

function pushedPanel(): boolean {
  const state: unknown = window.history.state;
  return Boolean(state && typeof state === 'object' && PANEL_ENTRY in state);
}

/**
 * The list's place and a setter that writes it to the address with the browser's
 * history (Next keeps useSearchParams in step), so no request goes to the server and
 * the page does not scroll. Each change builds on the address as it is now, so two quick
 * changes (a search, then a view chip) both stay. A new search, view, sort or page size goes back to
 * page 1 unless the change names a page itself.
 *
 * Opening a row's panel adds a history entry, so Geri (a phone's back swipe) closes the
 * panel instead of leaving the list; closing it with its own button goes back over that
 * entry. Every other change replaces the entry.
 */
export function useListParams({
  view: defaultView = 'all',
  sort: defaultSort = '',
}: { view?: string; sort?: string } = {}): [ListParams, (change: Partial<ListParams>) => void] {
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
      const live = new URLSearchParams(window.location.search);
      const now = readListParams(live, defaults);
      const resets = 'q' in change || 'view' in change || 'sort' in change || 'size' in change;
      const next: ListParams = { ...now, ...(resets ? { page: 1 } : {}), ...change };
      const href = listParamsHref(pathname, live, next, defaults);
      if (!now.panel && next.panel) {
        window.history.pushState({ [PANEL_ENTRY]: true }, '', href);
      } else if (
        now.panel &&
        !next.panel &&
        pushedPanel() &&
        listParamsHref(pathname, live, { ...now, panel: null }, defaults) === href
      ) {
        // Closing the panel the list opened: back over its entry, as Geri would
        window.history.back();
      } else {
        window.history.replaceState(
          pushedPanel() && next.panel ? { [PANEL_ENTRY]: true } : null,
          '',
          href,
        );
      }
    },
    [pathname, defaults],
  );
  return [state, set];
}
