'use client';

import {
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  Drawer as Panel,
} from '@skylab-kulubu/skylcn-ui';
import { useRef, type ReactNode } from 'react';

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /**
   * Where focus goes on close when the control that opened the drawer is gone,
   * e.g. the row of a record the drawer just deleted. Without it focus would
   * fall to the page body.
   */
  fallbackFocus?: () => HTMLElement | null;
};

/** A side panel from the right with a title; skylcn-ui's Drawer, swiped or Esc to close. */
const FIELD = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

export function Drawer({ open, onClose, title, children, fallbackFocus }: DrawerProps) {
  const body = useRef<HTMLDivElement>(null);
  // The control focused when the drawer opened: Base UI returns focus there on close
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current && typeof document !== 'undefined') {
    opener.current = document.activeElement as HTMLElement | null;
  }
  wasOpen.current = open;
  return (
    <Panel open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      {/* A panel with a form starts in its first field, as before */}
      <DrawerContent
        initialFocus={() => body.current?.querySelector<HTMLElement>(FIELD) ?? true}
        // Back to the control that opened it, or to the fallback once that control is gone
        finalFocus={
          fallbackFocus
            ? () => (opener.current?.isConnected ? opener.current : (fallbackFocus() ?? true))
            : undefined
        }
      >
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <DrawerBody ref={body} className="flex flex-col gap-3">
          {children}
        </DrawerBody>
      </DrawerContent>
    </Panel>
  );
}
