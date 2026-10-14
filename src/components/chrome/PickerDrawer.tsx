'use client';

import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { listStatus } from '@/lib/list-status';
import type { ReactNode } from 'react';

export type PickerOption = {
  id: string;
  title: string;
  subtitle?: string;
};

export function PickerDrawer({
  open,
  onClose,
  title,
  query,
  onQuery,
  placeholder,
  loading,
  failed,
  options,
  emptyMessage,
  onPick,
  error,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
  loading: boolean;
  failed?: boolean;
  options: PickerOption[];
  emptyMessage: string;
  onPick: (id: string) => void;
  /** Why the last pick failed, shown inside the drawer above the list. */
  error?: string | null;
  /** A question asked about a pick (useConfirm's dialog), so it opens over the drawer. */
  children?: ReactNode;
}) {
  return (
    <Drawer open={open} onClose={onClose} title={title}>
      <Field
        type="search"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder={placeholder}
        autoFocus
      />
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <ListPanel
        status={listStatus({
          loading,
          failed,
          rowCount: options.length,
          emptyMessage,
        })}
      >
        {options.map((row) => (
          <ListItem
            key={row.id}
            title={row.title}
            subtitle={row.subtitle}
            onSelect={() => onPick(row.id)}
          />
        ))}
      </ListPanel>
      {children}
    </Drawer>
  );
}
