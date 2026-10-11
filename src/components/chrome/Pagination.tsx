'use client';

import { Pagination as Pages } from '@skylab-kulubu/skylcn-ui';

type PaginationProps = {
  current?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  className?: string;
};

export function Pagination({
  current = 1,
  totalPages = 1,
  onPageChange = () => undefined,
  className,
}: PaginationProps) {
  return (
    <Pages
      current={current}
      totalPages={totalPages}
      onPageChange={onPageChange}
      className={className}
    />
  );
}
