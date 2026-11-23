'use client';

import { FilterPills as Pills, SearchInput } from '@skylab-kulubu/skylcn-ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Select } from '@/components/chrome/Select';

export type ListView<T extends string = string> = {
  value: T;
  label: string;
  /** How many rows the view holds; "Gelmedi 21". */
  count?: number;
};

export type ListSort<T extends string = string> = {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
};

/**
 * The row over a list: search, the view chips with their counts, then whatever the
 * page adds (a filter button, a team picker), and at the end the sort and the
 * column picker. Wraps on narrow screens; the chips scroll sideways on phones.
 */
export function ListToolbar<V extends string = string, S extends string = string>({
  query,
  onQuery,
  placeholder,
  searchLabel,
  commitDelay = 0,
  views,
  view,
  onView,
  viewsLabel = 'Görünüm',
  sort,
  columns,
  children,
}: {
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
  searchLabel: string;
  /**
   * Waits this long after the last key before `onQuery`, for a search kept in the
   * address (useListParams); the box answers every key at once either way.
   */
  commitDelay?: number;
  views?: ReadonlyArray<ListView<V>>;
  view?: V;
  onView?: (value: V) => void;
  viewsLabel?: string;
  sort?: ListSort<S>;
  /** The ColumnPicker, on wide screens. */
  columns?: ReactNode;
  children?: ReactNode;
}) {
  const [draft, setDraft] = useState(query);
  const committed = useRef(query);
  // A query changed from outside (cleared filters, the back button) replaces the draft
  useEffect(() => {
    if (query !== committed.current) {
      committed.current = query;
      setDraft(query);
    }
  }, [query]);
  useEffect(() => {
    if (draft === committed.current) return;
    if (commitDelay <= 0) {
      committed.current = draft;
      onQuery(draft);
      return;
    }
    const handle = window.setTimeout(() => {
      committed.current = draft;
      onQuery(draft);
    }, commitDelay);
    return () => window.clearTimeout(handle);
  }, [draft, commitDelay, onQuery]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="max-w-sm min-w-[180px] flex-1">
        <SearchInput
          compact
          value={draft}
          onValueChange={setDraft}
          placeholder={placeholder}
          aria-label={searchLabel}
        />
      </div>
      {views && view !== undefined && onView ? (
        <div className="-mx-1 max-w-full overflow-x-auto px-1 pb-1 sm:pb-0 [&_button]:whitespace-nowrap">
          <Pills value={view} onValueChange={onView} options={views} aria-label={viewsLabel} />
        </div>
      ) : null}
      {children}
      {sort || columns ? (
        <div className="ml-auto flex items-center gap-2">
          {sort ? (
            <Select
              aria-label="Sıralama"
              className="w-40"
              value={sort.value}
              onChange={(change) => sort.onChange(change.target.value as S)}
            >
              {sort.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          ) : null}
          {columns ? <div className="hidden lg:block">{columns}</div> : null}
        </div>
      ) : null}
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
  options: ReadonlyArray<{ value: T; label: string; count?: number }>;
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
    <div className="text-subtle-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
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
