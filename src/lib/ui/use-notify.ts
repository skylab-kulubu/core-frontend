'use client';

import { useToast } from '@skylab-kulubu/skylcn-ui';
import { useMemo } from 'react';
import { coreProblemMessage } from '@/lib/core-problems';

/**
 * Why Geri al did not work, in Turkish: the panel's one problem text
 * (core-problems), with 403/404/409 worded for undoing.
 */
export function undoFailureReason(err: unknown): string {
  return coreProblemMessage(err, 'Geri alma tamamlanamadı. Sayfayı yenileyip tekrar dene.', {
    403: 'Bunu geri almaya yetkin yok.',
    404: 'Kayıt bulunamadı; bu arada kalıcı olarak silinmiş olabilir.',
    409: 'Bu kayıt artık geri alınamıyor: bağlı olduğu etkinlik ya da gün silinmiş veya etkinlik aktif değil.',
  });
}

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
       * Says a removal went through and offers Geri al while the toast shows.
       * How long each toast stays is skylcn-ui's (useToast): a plain one five
       * seconds, one with an action ten, an error until it is closed, all
       * paused while hovered or focused. `undo` calls core's restore; `undone`
       * is said once it worked, the problem if it did not.
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
                // Read out at once: the reader may have looked away
                (err: unknown) =>
                  add({
                    title: 'Geri alınamadı',
                    description: undoFailureReason(err),
                    type: 'error',
                    priority: 'high',
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
