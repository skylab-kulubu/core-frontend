'use client';

import { IconButton } from '@skylab-kulubu/skylcn-ui';
import { ChevronDown, ChevronUp, Maximize2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, type ReactNode } from 'react';
import { Drawer } from '@/components/chrome/Drawer';

/**
 * Moves to the next or previous row's panel with ↓/↑ while a panel is open,
 * unless the reader is typing.
 */
function usePanelKeys(open: boolean, onPrev?: () => void, onNext?: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (
        target?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')
      )
        return;
      if (event.key === 'ArrowDown' && onNext) {
        event.preventDefault();
        onNext();
      } else if (event.key === 'ArrowUp' && onPrev) {
        event.preventDefault();
        onPrev();
      }
    };
    // Captured: the drawer's own key handling may stop the event before it bubbles
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onPrev, onNext]);
}

/**
 * A list row's details beside the list (Microsoft 365 "Active users"): opens from
 * the right, "Tam sayfa" leads to the row's own page, ↑/↓ and the arrows step
 * through the rows. On phones it takes nearly the whole screen. Keep the open row
 * in the address (`useListParams().panel`) so a link or reload opens it again.
 */
export function SidePanel({
  open,
  onClose,
  title,
  href,
  onPrev,
  onNext,
  dirty,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** The row's own page; drawn as "Tam sayfa". */
  href?: string;
  /** The row before and after; left out at the ends of the page. */
  onPrev?: () => void;
  onNext?: () => void;
  /** Unsaved typing in the panel: closing asks first. */
  dirty?: boolean;
  children: ReactNode;
}) {
  usePanelKeys(open && !dirty, onPrev, onNext);
  const actions = (
    <>
      {onPrev || onNext ? (
        <>
          <IconButton
            icon={ChevronUp}
            size="icon-sm"
            variant="ghost"
            label="Önceki"
            disabled={!onPrev}
            onClick={onPrev}
          />
          <IconButton
            icon={ChevronDown}
            size="icon-sm"
            variant="ghost"
            label="Sonraki"
            disabled={!onNext}
            onClick={onNext}
          />
        </>
      ) : null}
      {href ? (
        <IconButton
          icon={Maximize2}
          size="icon-sm"
          variant="ghost"
          label="Tam sayfa"
          render={<Link href={href} />}
        />
      ) : null}
    </>
  );
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      dirty={dirty}
      actions={actions}
      className="w-[min(100vw,480px)] sm:w-[min(92vw,480px)]"
    >
      {children}
    </Drawer>
  );
}

/**
 * The open row and its neighbours on the page shown, for a SidePanel: the row whose
 * id is `panel` and the ids before and after it.
 */
export function panelNeighbours<T>(
  rows: readonly T[],
  panel: string | null,
  idOf: (row: T) => string,
): { row: T | null; prev: string | null; next: string | null } {
  const at = panel === null ? -1 : rows.findIndex((row) => idOf(row) === panel);
  if (at < 0) return { row: null, prev: null, next: null };
  return {
    row: rows[at],
    prev: at > 0 ? idOf(rows[at - 1]) : null,
    next: at < rows.length - 1 ? idOf(rows[at + 1]) : null,
  };
}
