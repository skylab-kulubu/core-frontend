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
};

/** A side panel from the right with a title; skylcn-ui's Drawer, swiped or Esc to close. */
const FIELD = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

export function Drawer({ open, onClose, title, children }: DrawerProps) {
  const body = useRef<HTMLDivElement>(null);
  return (
    <Panel open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      {/* A panel with a form starts in its first field, as before */}
      <DrawerContent initialFocus={() => body.current?.querySelector<HTMLElement>(FIELD) ?? true}>
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
