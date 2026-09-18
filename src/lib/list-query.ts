export function matchesQuery(
  query: string,
  ...haystacks: Array<string | number | boolean | null | undefined>
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystacks.some((part) =>
    String(part ?? '')
      .toLowerCase()
      .includes(q),
  );
}

export function emptyListCopy(opts: {
  none: string;
  noneMatch: string;
  query?: string;
  filtered?: boolean;
}): string {
  if (opts.query?.trim() || opts.filtered) return opts.noneMatch;
  return opts.none;
}

export function paginateRows<T>(
  rows: readonly T[],
  page: number,
  pageSize = 10,
): { page: number; totalPages: number; total: number; slice: T[] } {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    totalPages,
    total,
    slice: rows.slice(start, start + pageSize),
  };
}
