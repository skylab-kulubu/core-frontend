'use client';

import type { ReactNode } from 'react';
import type { ListStatus } from '@/lib/list-status';

type ListPanelProps = {
  status: ListStatus;
  children?: ReactNode;
};

export function ListPanel({ status, children }: ListPanelProps) {
  return (
    <div className="divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
      {status.kind === 'loading' ? (
        <p className="px-3 py-2.5 text-sm text-neutral-500">Yükleniyor…</p>
      ) : status.kind === 'empty' ? (
        <p className="px-3 py-2.5 text-sm text-neutral-500">{status.message}</p>
      ) : (
        children
      )}
    </div>
  );
}
