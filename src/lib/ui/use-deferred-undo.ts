'use client';

import { useToast } from '@skylab-kulubu/skylcn-ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { undoFailureReason } from '@/lib/ui/use-notify';

/** How long a taken-back entry waits for Vazgeç before core is asked. */
export const UNDO_GRACE_MS = 6000;

type Pending = { timer: ReturnType<typeof setTimeout>; toast: string; run: () => void };

/**
 * Takes something back after a short wait instead of at once (Gmail's "Geri al" on a sent
 * mail): the request waits UNDO_GRACE_MS behind a toast with Vazgeç, and only then goes to
 * core. Used where the taken-back thing cannot be written again from the page, such as a door
 * entry, so the toast after the fact could not offer the way back.
 *
 * `pending` holds the keys still waiting, for the row to say so and offer Vazgeç in place.
 *
 * Going to another page of the panel sends what is waiting at once: the person pressed
 * Geri al and meant it. `run` shows its own failure while the page is up; once the page is
 * gone, a `run` that rejects gets a short error toast instead (the toast host outlives the
 * page). So `run` handles its error for the page and then rethrows it.
 *
 * Closing or reloading the tab cannot send it (the timer dies with the page), so while
 * something waits the browser asks before the tab goes.
 */
export function useDeferredUndo() {
  const { add, close } = useToast();
  const waiting = useRef(new Map<string, Pending>());
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());

  const gone = useRef(false);
  const sync = useCallback(() => setPending(new Set(waiting.current.keys())), []);

  const cancel = useCallback(
    (key: string) => {
      const found = waiting.current.get(key);
      if (!found) return;
      clearTimeout(found.timer);
      waiting.current.delete(key);
      close(found.toast);
      sync();
    },
    [close, sync],
  );

  const schedule = useCallback(
    (key: string, title: string, run: () => Promise<unknown> | void) => {
      if (waiting.current.has(key)) return;
      const go = () => {
        const found = waiting.current.get(key);
        if (!found) return;
        waiting.current.delete(key);
        close(found.toast);
        if (!gone.current) sync();
        Promise.resolve()
          .then(() => run())
          .catch((err: unknown) => {
            if (!gone.current) return;
            add({
              title: 'Geri alınamadı',
              description: undoFailureReason(err),
              type: 'error',
              priority: 'high',
            });
          });
      };
      const toast = add({
        title,
        type: 'info',
        timeout: UNDO_GRACE_MS,
        actionProps: {
          children: 'Vazgeç',
          onClick: () => cancel(key),
        },
      });
      waiting.current.set(key, { timer: setTimeout(go, UNDO_GRACE_MS), toast, run: go });
      sync();
    },
    [add, cancel, close, sync],
  );

  useEffect(() => {
    if (pending.size === 0) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers ask only when returnValue is set
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [pending]);

  useEffect(() => {
    const map = waiting.current;
    gone.current = false;
    return () => {
      gone.current = true;
      for (const found of [...map.values()]) {
        clearTimeout(found.timer);
        found.run();
      }
    };
  }, []);

  return useMemo(() => ({ pending, schedule, cancel }), [pending, schedule, cancel]);
}
