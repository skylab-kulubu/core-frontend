'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  MenuCheckboxItem,
} from '@skylab-kulubu/skylcn-ui';
import { Columns3 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BUTTON_TEXT } from '@/lib/ui/type-scale';

export type ColumnChoice = {
  id: string;
  label: string;
  /** Always shown and not offered in the picker, such as the name. */
  fixed?: boolean;
  /** Left off until the reader turns it on. */
  hidden?: boolean;
};

/**
 * Which of a list's columns the reader shows, remembered in this browser under
 * `storageKey` (a per-person convenience, as Entra's "Columns"; no saved views).
 */
export function useColumnChoice(storageKey: string, columns: readonly ColumnChoice[]) {
  // Keyed by the columns' ids and flags, not the array: a page may build it on each draw
  const shape = columns
    .map((column) => `${column.id}${column.fixed ? '!' : ''}${column.hidden ? '?' : ''}`)
    .join(',');
  const parsed = useMemo(
    () =>
      shape
        ? shape.split(',').map((part) => ({
            id: part.replace(/[!?]+$/, ''),
            fixed: /!\??$/.test(part),
            hidden: part.endsWith('?'),
          }))
        : [],
    [shape],
  );
  const defaults = useMemo(
    () => parsed.filter((column) => column.fixed || !column.hidden).map((column) => column.id),
    [parsed],
  );
  const [shown, setShown] = useState<string[]>(defaults);
  useEffect(() => {
    let next = defaults;
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null') as unknown;
      if (Array.isArray(saved)) {
        const known = new Set(parsed.map((column) => column.id));
        const fixed = parsed.filter((column) => column.fixed).map((column) => column.id);
        next = [...new Set([...fixed, ...saved.filter((id) => known.has(id))])];
      }
    } catch {
      // Storage can be unavailable or hold something else; the defaults stay
    }
    setShown(next);
  }, [storageKey, parsed, defaults]);
  const toggle = useCallback(
    (id: string) => {
      setShown((current) => {
        const next = current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id];
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // Not remembering is fine
        }
        return next;
      });
    },
    [storageKey],
  );
  const isShown = useCallback((id: string) => shown.includes(id), [shown]);
  return { isShown, toggle };
}

/** "Sütunlar": a menu of the list's optional columns, each ticked while it shows. */
export function ColumnPicker({
  columns,
  isShown,
  onToggle,
}: {
  columns: readonly ColumnChoice[];
  isShown: (id: string) => boolean;
  onToggle: (id: string) => void;
}) {
  const optional = columns.filter((column) => !column.fixed);
  if (!optional.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className={BUTTON_TEXT}>
            <Columns3 className="size-4" aria-hidden />
            Sütunlar
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {optional.map((column) => (
          <MenuCheckboxItem
            key={column.id}
            checked={isShown(column.id)}
            onCheckedChange={() => onToggle(column.id)}
          >
            {column.label}
          </MenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
