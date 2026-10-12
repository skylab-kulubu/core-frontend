'use client';

import { useToast } from '@skylab-kulubu/skylcn-ui';
import { useMemo } from 'react';

/**
 * Says that a write went through, as a short toast in the app's polite live
 * region (skylcn-ui's ToastProvider). Errors are not toasts: they stay where
 * the work is, in the form or drawer that sent it.
 */
export function useNotify() {
  const { add } = useToast();
  return useMemo(
    () => ({
      success(title: string) {
        add({ title, type: 'success' });
      },
    }),
    [add],
  );
}
