'use client';

import { Skeleton } from '@skylab-kulubu/skylcn-ui';

/**
 * A page's shape while it loads, in place of a "Yükleniyor…" line: the header, then tabs (an
 * event), rows (a list) or fields (a record). Screen readers hear one "Yükleniyor".
 *
 * Built from skylcn-ui's Skeleton; a page-level skeleton belongs in skylcn-ui (Kaan).
 */
export function PageSkeleton({ variant = 'list' }: { variant?: 'list' | 'workspace' | 'detail' }) {
  return (
    <div role="status" aria-live="polite" className="space-y-6" data-testid="page-skeleton">
      <span className="sr-only">Yükleniyor</span>
      <div className="space-y-2">
        <Skeleton className="h-6 w-56 max-w-full" />
        <Skeleton className="h-3 w-80 max-w-full" />
        {variant === 'workspace' ? (
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-20" />
          </div>
        ) : null}
      </div>
      {variant === 'workspace' ? (
        <>
          <div className="border-border flex gap-6 overflow-hidden border-b pb-3">
            {[24, 20, 16, 22, 12, 18].map((width, i) => (
              <Skeleton key={i} className="h-4 shrink-0" style={{ width: `${width * 4}px` }} />
            ))}
          </div>
          <SkeletonLines count={4} />
        </>
      ) : variant === 'detail' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <SkeletonRows />
      )}
    </div>
  );
}

/** Text lines of varied length, for a tab's content. */
export function SkeletonLines({ count = 4 }: { count?: number }) {
  const widths = ['w-11/12', 'w-2/3', 'w-5/6', 'w-1/2', 'w-3/4'];
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={`h-4 ${widths[i % widths.length]}`} />
      ))}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-9 w-full max-w-sm" />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
