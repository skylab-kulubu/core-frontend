'use client';

import { useToast } from '@skylab-kulubu/skylcn-ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
 * Leaving the page sends what is waiting: the person pressed Geri al and meant it.
 */
export function useDeferredUndo() {
  const { add, close } = useToast();
  const waiting = useRef(new Map<string, Pending>());
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());

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
        sync();
        void run();
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
    const map = waiting.current;
    return () => {
      for (const found of [...map.values()]) {
        clearTimeout(found.timer);
        found.run();
      }
    };
  }, []);

  return useMemo(() => ({ pending, schedule, cancel }), [pending, schedule, cancel]);
}
