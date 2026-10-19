'use client';

import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { SaveButton } from '@/components/chrome/SaveButton';
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
  selection,
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
  onPick?: (id: string) => void;
  /** Opt-in selection retained by the caller across searches. */
  selection?: {
    items: PickerOption[];
    onChange: (items: PickerOption[]) => void;
    onSubmit: () => void;
    busy: boolean;
    submitLabel: string;
  };
  /** Why the last pick failed, shown inside the drawer above the list. */
  error?: string | null;
  /** A question asked about a pick (useConfirm's dialog), so it opens over the drawer. */
  children?: ReactNode;
}) {
  return (
    <Drawer
      open={open}
      onClose={() => {
        if (!selection?.busy) onClose();
      }}
      title={title}
    >
      <Field
        type="search"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder={placeholder}
        disabled={selection?.busy}
        autoFocus
      />
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {selection ? (
        <div className="space-y-2">
          <p role="status" className="text-sm">
            {selection.items.length} kişi seçildi
          </p>
          {selection.items.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={selection.busy}
              className="text-muted-foreground text-sm underline"
              aria-label={`${item.title} seçimini kaldır`}
              onClick={() =>
                selection.onChange(selection.items.filter((row) => row.id !== item.id))
              }
            >
              {item.title} ×
            </button>
          ))}
          <SaveButton
            type="button"
            disabled={selection.busy || selection.items.length === 0}
            onClick={selection.onSubmit}
          >
            {selection.busy ? 'Ekleniyor…' : selection.submitLabel}
          </SaveButton>
        </div>
      ) : null}
      <ListPanel
        status={listStatus({
          loading,
          failed,
          rowCount: options.length,
          emptyMessage,
        })}
      >
        {options.map((row) =>
          selection ? (
            <label key={row.id} className="flex items-center gap-3 rounded-md p-3">
              <input
                type="checkbox"
                disabled={selection.busy}
                checked={selection.items.some((item) => item.id === row.id)}
                onChange={(event) =>
                  selection.onChange(
                    event.target.checked
                      ? [...selection.items, row]
                      : selection.items.filter((item) => item.id !== row.id),
                  )
                }
              />
              <span>
                <span className="block">{row.title}</span>
                {row.subtitle ? (
                  <span className="text-muted-foreground block text-sm">{row.subtitle}</span>
                ) : null}
              </span>
            </label>
          ) : (
            <ListItem
              key={row.id}
              title={row.title}
              subtitle={row.subtitle}
              onSelect={() => onPick?.(row.id)}
            />
          ),
        )}
      </ListPanel>
      {children}
    </Drawer>
  );
}
