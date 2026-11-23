'use client';

import { Pagination as Pages } from '@skylab-kulubu/skylcn-ui';

type PaginationProps = {
  current?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  /** Names the navigation when a page has two (above and under a list). */
  label?: string;
  className?: string;
};

export function Pagination({
  current = 1,
  totalPages = 1,
  onPageChange = () => undefined,
  label,
  className,
}: PaginationProps) {
  return (
    <Pages
      current={current}
      totalPages={totalPages}
      onPageChange={onPageChange}
      aria-label={label}
      className={className}
    />
  );
}
