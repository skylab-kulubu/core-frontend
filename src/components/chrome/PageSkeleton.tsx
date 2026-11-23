'use client';

import { Skeleton } from '@skylab-kulubu/skylcn-ui';

/**
 * A page's shape while it loads, in place of a "Yükleniyor…" line: an object page (an event),
 * rows (a list) or fields (a record). Screen readers hear one "Yükleniyor".
 *
 * Built from skylcn-ui's Skeleton; a page-level skeleton belongs in skylcn-ui (Kaan).
 */
export function PageSkeleton({ variant = 'list' }: { variant?: 'list' | 'workspace' | 'detail' }) {
  if (variant === 'workspace') return <ObjectPageSkeleton />;
  return (
    <div role="status" aria-live="polite" className="space-y-6" data-testid="page-skeleton">
      <span className="sr-only">Yükleniyor</span>
      <div className="space-y-2">
        <Skeleton className="h-6 w-56 max-w-full" />
        <Skeleton className="h-3 w-80 max-w-full" />
      </div>
      {variant === 'detail' ? (
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

/**
 * An object page while it loads (an event): the cover band, the command row, the object's menu
 * on the left from the lg breakpoint (its button on a phone) and the overview's first cards.
 */
function ObjectPageSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-4" data-testid="page-skeleton">
      <span className="sr-only">Yükleniyor</span>
      <div className="border-border-subtle bg-card flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:gap-5 sm:p-4">
        <Skeleton className="aspect-video w-full shrink-0 rounded-lg sm:w-52" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-7 w-64 max-w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>
      </div>
      <div className="border-border-subtle flex gap-3 overflow-hidden border-b pb-2">
        {[18, 20, 14, 26, 14].map((width, i) => (
          <Skeleton key={i} className="h-7 shrink-0" style={{ width: `${width * 4}px` }} />
        ))}
      </div>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
        <div className="space-y-2">
          <Skeleton className="h-9 w-full lg:hidden" />
          <div className="hidden space-y-2 lg:block">
            {[28, 24, 20, 18, 24, 20].map((width, i) => (
              <Skeleton key={i} className="h-7" style={{ width: `${width * 6}px` }} />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-44 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
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
