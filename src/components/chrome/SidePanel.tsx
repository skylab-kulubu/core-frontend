'use client';

import { IconButton } from '@skylab-kulubu/skylcn-ui';
import { ChevronDown, ChevronUp, Maximize2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Drawer } from '@/components/chrome/Drawer';
import { useConfirm } from '@/lib/ui/use-confirm';
import { DISCARD_ACTION, DISCARD_TITLE } from '@/lib/ui/use-unsaved-changes';

/** Keys inside these belong to the control: a menu, a list box, tabs, a field, a dialog. */
const OWN_ARROWS = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="listbox"]',
  '[role="option"]',
  '[role="combobox"]',
  '[role="radiogroup"]',
  '[role="radio"]',
  '[role="tablist"]',
  '[role="tab"]',
  '[role="slider"]',
  '[role="grid"]',
  '[role="tree"]',
  '[role="alertdialog"]',
].join(', ');

/** Whether the panel's body can still scroll that way: the arrow scrolls it first. */
function canScroll(body: HTMLElement | null, down: boolean): boolean {
  if (!body) return false;
  return down ? body.scrollTop + body.clientHeight < body.scrollHeight - 1 : body.scrollTop > 0;
}

/**
 * Steps to the next or previous row with ↓/↑ while the focus is in the panel and on
 * none of its own controls (a menu, a list box, tabs, a field, a question), and only
 * once the panel's body has nothing left to scroll that way.
 */
function usePanelKeys(
  open: boolean,
  content: RefObject<HTMLDivElement | null>,
  onPrev?: () => void,
  onNext?: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const down = event.key === 'ArrowDown';
      if (!down && event.key !== 'ArrowUp') return;
      const step = down ? onNext : onPrev;
      if (!step) return;
      const panel = content.current?.closest<HTMLElement>('[role="dialog"]');
      const target = event.target instanceof Element ? event.target : null;
      if (!panel || !target || !panel.contains(target)) return;
      if (target.closest(OWN_ARROWS)) return;
      if (canScroll(content.current?.parentElement ?? null, down)) return;
      event.preventDefault();
      step();
    };
    // Captured: the dialog keeps its keys from bubbling; the checks above leave its controls alone
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, content, onPrev, onNext]);
}

/**
 * A list row's details beside the list (Microsoft 365 "Active users"): opens from
 * the right, "Tam sayfa" leads to the row's own page, ↑/↓ and the arrows step
 * through the rows. On phones it takes nearly the whole screen. Keep the open row
 * in the address (`useListParams().panel`) so a link or reload opens it again.
 * With unsaved typing (`dirty`), closing and stepping to another row ask first.
 * Put the row's facts in ObjectCard / ObjectEssentials, as on an object's overview.
 */
export function SidePanel({
  open,
  onClose,
  title,
  href,
  onPrev,
  onNext,
  dirty,
  finalFocus,
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
  /** Unsaved typing in the panel: closing or stepping asks first. */
  dirty?: boolean;
  /**
   * Where focus goes on close, such as the row now open (after ↑/↓) rather than
   * the one first clicked.
   */
  finalFocus?: () => HTMLElement | null;
  children: ReactNode;
}) {
  const content = useRef<HTMLDivElement>(null);
  const [confirm, confirmDialog] = useConfirm();
  const guard = useCallback(
    (step?: () => void) =>
      step
        ? () => {
            if (!dirty) {
              step();
              return;
            }
            confirm({
              title: DISCARD_TITLE,
              actionLabel: DISCARD_ACTION,
              destructive: true,
              onConfirm: step,
            });
          }
        : undefined,
    [dirty, confirm],
  );
  const prev = guard(onPrev);
  const next = guard(onNext);
  usePanelKeys(open, content, prev, next);
  const actions = (
    <>
      {onPrev || onNext ? (
        <>
          <IconButton
            icon={ChevronUp}
            size="icon-sm"
            variant="ghost"
            label="Önceki"
            disabled={!prev}
            onClick={prev}
          />
          <IconButton
            icon={ChevronDown}
            size="icon-sm"
            variant="ghost"
            label="Sonraki"
            disabled={!next}
            onClick={next}
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
      finalFocus={finalFocus}
      actions={actions}
      className="w-[min(100vw,480px)] sm:w-[min(92vw,480px)]"
    >
      <div ref={content} className="flex flex-col gap-3">
        {children}
      </div>
      {confirmDialog}
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
