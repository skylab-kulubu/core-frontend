'use client';

import { FilterPills as Pills, SearchInput } from '@skylab-kulubu/skylcn-ui';
import type { ReactNode } from 'react';

export function ListToolbar({
  query,
  onQuery,
  placeholder,
  searchLabel,
  children,
}: {
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
  searchLabel: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="max-w-sm min-w-[180px] flex-1">
        <SearchInput
          compact
          value={query}
          onValueChange={onQuery}
          placeholder={placeholder}
          aria-label={searchLabel}
        />
      </div>
      {children}
    </div>
  );
}

export function FilterPills<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  ariaLabel: string;
}) {
  return <Pills value={value} onValueChange={onChange} options={options} aria-label={ariaLabel} />;
}

export function ListFooterMeta({
  items,
}: {
  items: ReadonlyArray<{ label: string; value: string | number }>;
}) {
  return (
    <div className="text-2xs text-subtle-foreground flex flex-wrap gap-x-4 gap-y-1">
      {items.map((item) => (
        <span key={item.label}>
          {item.label}{' '}
          <strong className="text-secondary-foreground font-medium tabular-nums">
            {item.value}
          </strong>
        </span>
      ))}
    </div>
  );
}
