'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useConfirm } from '@/lib/ui/use-confirm';

/** The one question before unsaved work is thrown away, on a page or in a drawer. */
export const DISCARD_TITLE = 'Kaydedilmemiş değişiklikler silinsin mi?';
export const DISCARD_ACTION = 'Değişiklikleri sil';

/**
 * The in-app address a click on this anchor goes to, or null when the click
 * is not a plain same-tab navigation to another page of this app: a new tab,
 * a download, a modifier key, an in-page anchor, another site (that one the
 * browser's own beforeunload question covers).
 */
export function guardedHref(event: MouseEvent, location: Location): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const target = event.target instanceof Element ? event.target : null;
  const anchor = target?.closest('a[href]');
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.target && anchor.target !== '_self') return null;
  if (anchor.hasAttribute('download')) return null;
  let url: URL;
  try {
    url = new URL(anchor.href, location.href);
  } catch {
    return null;
  }
  if (url.origin !== location.origin) return null;
  if (url.pathname === location.pathname && url.search === location.search) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Keeps typed work from going away unasked while `dirty`: closing or reloading
 * the tab gets the browser's question, and a link to another page of the panel
 * asks first. `allowLeave` lets one deliberate departure through, such as a
 * save that goes on to the event or a trip to the form editor with the draft
 * kept. Render `dialog` once.
 */
export function useUnsavedChanges(dirty: boolean): {
  dialog: ReactNode;
  allowLeave: () => void;
  /** Leaves for `href`, asking first when there is unsaved work. */
  leave: (href: string) => void;
} {
  const router = useRouter();
  const [confirm, dialog] = useConfirm();
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const allowed = useRef(false);

  const allowLeave = useCallback(() => {
    allowed.current = true;
  }, []);

  const leave = useCallback(
    (href: string) => {
      if (!dirtyRef.current || allowed.current) {
        router.push(href);
        return;
      }
      confirm({
        title: DISCARD_TITLE,
        actionLabel: DISCARD_ACTION,
        destructive: true,
        onConfirm: () => {
          allowed.current = true;
          router.push(href);
        },
      });
    },
    [confirm, router],
  );

  const leaveRef = useRef(leave);
  leaveRef.current = leave;

  // New unsaved work after a let-through departure is guarded again
  useEffect(() => {
    if (dirty) allowed.current = false;
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowed.current) return;
      event.preventDefault();
      // Older browsers ask only when returnValue is set
      event.returnValue = '';
    };
    const onClick = (event: MouseEvent) => {
      if (allowed.current) return;
      const href = guardedHref(event, window.location);
      if (!href) return;
      // Before Next's Link sees the click: it would navigate on its own
      event.preventDefault();
      event.stopPropagation();
      leaveRef.current(href);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);

  return { dialog, allowLeave, leave };
}

/**
 * Whether `value` changed since the drawer opened, for a form kept in plain
 * state: what it held when `open` turned on is the baseline.
 */
export function useDirtySince(open: boolean, value: unknown): boolean {
  const current = JSON.stringify(value);
  const [baseline, setBaseline] = useState<string | null>(null);
  if (open && baseline === null) setBaseline(current);
  if (!open && baseline !== null) setBaseline(null);
  return open && baseline !== null && baseline !== current;
}
