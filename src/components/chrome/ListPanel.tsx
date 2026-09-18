'use client';

import type { ReactNode } from 'react';
import type { ListStatus } from '@/lib/list-status';

type ListPanelProps = {
  status: ListStatus;
  children?: ReactNode;
  framed?: boolean;
};

export function ListPanel({ status, children, framed = true }: ListPanelProps) {
  const body =
    status.kind === 'loading' ? (
      <p className="px-3 py-2.5 text-sm text-neutral-500">Yükleniyor…</p>
    ) : status.kind === 'empty' ? (
      <p className="px-3 py-2.5 text-sm text-neutral-500">{status.message}</p>
    ) : (
      children
    );
  return (
    <div
      className={
        framed
          ? 'divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10'
          : 'divide-y divide-white/5'
      }
    >
      {body}
    </div>
  );
}
