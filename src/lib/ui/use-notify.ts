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
/**
 * Why Geri al did not work, in Turkish. core's titles are English
 * ("Conflict"); a detail that says more than the title is core's own
 * explanation and wins.
 */
export function undoFailureReason(err: unknown): string {
  if (!(err instanceof ProblemError)) {
    return 'Sunucuya ulaşılamadı. Bağlantını denetleyip sayfayı yenile.';
  }
  if (err.detail && err.detail !== err.title) return err.detail;
  switch (err.status) {
    case 403:
      return 'Bunu geri almaya yetkin yok.';
    case 404:
      return 'Kayıt bulunamadı; bu arada kalıcı olarak silinmiş olabilir.';
    case 409:
      return 'Bu kayıt artık geri alınamıyor: bağlı olduğu etkinlik ya da gün silinmiş veya etkinlik aktif değil.';
    default:
      return 'Sunucu isteği tamamlayamadı. Biraz sonra tekrar dene.';
  }
}

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
                // Stays until closed and is read out at once: the reader may have looked away
                (err: unknown) =>
                  add({
                    title: 'Geri alınamadı',
                    description: undoFailureReason(err),
                    type: 'error',
                    priority: 'high',
                    timeout: 0,
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
