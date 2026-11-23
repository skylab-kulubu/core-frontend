'use client';

import {
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  Drawer as Panel,
} from '@skylab-kulubu/skylcn-ui';
import { useRef, type ReactNode } from 'react';
import { useConfirm } from '@/lib/ui/use-confirm';
import { DISCARD_ACTION, DISCARD_TITLE } from '@/lib/ui/use-unsaved-changes';

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /**
   * Where focus goes on close instead of the control that opened the drawer,
   * e.g. after the drawer deleted its record and that row is going away.
   * Null keeps Base UI's default (back to the opener).
   */
  finalFocus?: () => HTMLElement | null;
  /**
   * Typed work not saved yet: Esc, a click outside or a swipe asks before the
   * drawer closes and drops it. The drawer's own Vazgeç still closes at once.
   */
  dirty?: boolean;
  /** Buttons or links at the end of the title row, such as "Tam sayfa". */
  actions?: ReactNode;
  /** Classes for the panel, such as a wider one for a list's row. */
  className?: string;
};

/** A side panel from the right with a title; skylcn-ui's Drawer, swiped or Esc to close. */
const FIELD = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

export function Drawer({
  open,
  onClose,
  title,
  children,
  finalFocus,
  dirty,
  actions,
  className,
}: DrawerProps) {
  const body = useRef<HTMLDivElement>(null);
  const [confirm, confirmDialog] = useConfirm();
  function requestClose() {
    if (!dirty) {
      onClose();
      return;
    }
    confirm({
      title: DISCARD_TITLE,
      actionLabel: DISCARD_ACTION,
      destructive: true,
      closesDrawer: true,
      onConfirm: onClose,
    });
  }
  return (
    <Panel open={open} onOpenChange={(next) => (next ? undefined : requestClose())}>
      {/* A panel with a form starts in its first field, as before */}
      <DrawerContent
        className={className}
        initialFocus={() => body.current?.querySelector<HTMLElement>(FIELD) ?? true}
        finalFocus={finalFocus ? () => finalFocus() ?? true : undefined}
      >
        <DrawerHeader className={actions ? 'flex-row items-center gap-2' : undefined}>
          <DrawerTitle className={actions ? 'flex-1' : undefined}>{title}</DrawerTitle>
          {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
        </DrawerHeader>
        <DrawerBody ref={body} className="flex flex-col gap-3">
          {children}
        </DrawerBody>
        {confirmDialog}
      </DrawerContent>
    </Panel>
  );
}
