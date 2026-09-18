'use client';

import type { ReactNode } from 'react';
import { Field } from '@/components/chrome/Field';

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
        <Field
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
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
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex h-8 items-center rounded-md border border-white/10 bg-neutral-900/60 p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`h-7 rounded px-2.5 text-xs transition-colors ${
              active
                ? 'bg-skylab-500/20 text-skylab-200'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function ListFooterMeta({
  items,
}: {
  items: ReadonlyArray<{ label: string; value: string | number }>;
}) {
  return (
    <div className="text-2xs flex flex-wrap gap-x-4 gap-y-1 text-neutral-500">
      {items.map((item) => (
        <span key={item.label}>
          {item.label}{' '}
          <strong className="font-medium text-neutral-300 tabular-nums">{item.value}</strong>
        </span>
      ))}
    </div>
  );
}
