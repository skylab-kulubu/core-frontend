'use client';

import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronsRight, X } from 'lucide-react';
import { useBackgroundInert } from '@/lib/ui/use-background-inert';
import { useBodyScrollLock } from '@/lib/ui/use-body-scroll-lock';
import { isTopModalLayer, registerModalLayer } from '@/lib/ui/modal-layer';

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export function Drawer({ open, onClose, title, children }: DrawerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  useBodyScrollLock(open);
  useBackgroundInert(open, overlayRef);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const unregisterLayer = registerModalLayer(titleId);
    const dialog = dialogRef.current;
    const focusable = contentRef.current?.querySelector<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    );
    (focusable ?? dialog)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!isTopModalLayer(titleId)) return;
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const items = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!items.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      unregisterLayer();
      window.setTimeout(() => returnFocusRef.current?.focus(), 0);
    };
  }, [open, titleId]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div ref={overlayRef} className="fixed inset-0 z-50 overflow-hidden">
      <button
        type="button"
        className="absolute inset-0 bg-neutral-900/40 backdrop-blur-[1px]"
        aria-label="Paneli kapat"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 right-0 flex">
        <button
          type="button"
          onClick={onClose}
          className="group relative flex h-full w-5 flex-col items-center justify-center rounded-l-full border-y border-l border-neutral-800 bg-[#121212] text-neutral-500 hover:text-neutral-300"
          title="Paneli kapat"
        >
          <ChevronsRight size={14} strokeWidth={2.5} />
        </button>
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="h-full w-[min(92vw,420px)] overflow-y-auto border-y border-r border-neutral-800 bg-[#121212] p-5 shadow-2xl"
        >
          <div className="flex items-center gap-3">
            <h2
              id={titleId}
              className="min-w-0 flex-1 truncate text-lg font-semibold text-neutral-100"
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Paneli kapat"
              className="focus-visible:ring-skylab-400/40 rounded-md p-1.5 text-neutral-500 hover:bg-white/5 hover:text-neutral-100 focus-visible:ring-2 focus-visible:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div ref={contentRef} className="mt-4 space-y-3">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
