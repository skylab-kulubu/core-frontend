'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { StateCard } from '@/components/chrome/StateCard';
import type { ListStatus } from '@/lib/list-status';

type ListPanelProps = {
  status: ListStatus;
  children?: ReactNode;
  framed?: boolean;
  emptyIcon?: LucideIcon;
  emptyDescription?: string;
  emptyAction?: ReactNode;
};

export function ListPanel({
  status,
  children,
  framed = true,
  emptyIcon,
  emptyDescription,
  emptyAction,
}: ListPanelProps) {
  const body =
    status.kind === 'loading' ? (
      <StateCard title="Yükleniyor…" isLoading />
    ) : status.kind === 'empty' ? (
      <StateCard title={status.message} description={emptyDescription} Icon={emptyIcon}>
        {emptyAction}
      </StateCard>
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
