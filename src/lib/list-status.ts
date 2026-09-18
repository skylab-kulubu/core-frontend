export type ListStatus =
  | { kind: 'loading' }
  | { kind: 'empty'; message: string }
  | { kind: 'ready' };

export function listStatus(opts: {
  loading: boolean;
  failed?: boolean;
  rowCount: number;
  emptyMessage: string;
}): ListStatus {
  if (opts.loading) return { kind: 'loading' };
  if (opts.failed) return { kind: 'ready' };
  if (opts.rowCount === 0) return { kind: 'empty', message: opts.emptyMessage };
  return { kind: 'ready' };
}
