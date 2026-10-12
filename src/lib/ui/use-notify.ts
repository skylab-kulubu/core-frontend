'use client';

import { useToast } from '@skylab-kulubu/skylcn-ui';
import { useMemo } from 'react';
import { ProblemError } from '@/lib/api/core';

/**
 * Says that a write went through, as a short toast in the app's polite live
 * region (skylcn-ui's ToastProvider). Errors are not toasts: they stay where
 * the work is, in the form or drawer that sent it. The one exception is a
 * failed Geri al, whose only place is the toast it was pressed in.
 */
export function useNotify() {
  const { add, close } = useToast();
  return useMemo(
    () => ({
      success(title: string) {
        add({ title, type: 'success' });
      },
      /**
       * Says a removal went through and offers Geri al while the toast shows
       * (five seconds, paused while hovered or focused). `undo` calls core's
       * restore; `undone` is said once it worked, the problem if it did not.
       */
      undoable(title: string, undo: () => Promise<unknown>, undone: string) {
        const id = add({
          title,
          type: 'success',
          actionProps: {
            children: 'Geri al',
            onClick: () => {
              close(id);
              undo().then(
                () => add({ title: undone, type: 'success' }),
                (err: unknown) =>
                  add({
                    title: 'Geri alınamadı',
                    description: err instanceof ProblemError ? err.title : undefined,
                    type: 'error',
                  }),
              );
            },
          },
        });
      },
    }),
    [add, close],
  );
}
