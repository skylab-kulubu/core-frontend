'use client';

import { ConfirmDialog } from '@skylab-kulubu/skylcn-ui';
import { useState, type ReactNode } from 'react';

/** The description's closing line for a removal core can undo. */
export const UNDO_HINT = 'Hemen ardından çıkan bildirimdeki Geri al ile geri getirebilirsin.';

export type ConfirmRequest = {
  /** Names the action and its target: '"Açılış" oturumu silinsin mi?' */
  title: string;
  /** What happens next: who is told, whether it can be undone. */
  description?: string;
  /** A verb for the action, such as "Oturumu sil"; never "Tamam". */
  actionLabel: string;
  /** Off for a confirmed action that removes nothing, such as a retry. */
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
};

/**
 * Asks before a destructive action with skylcn-ui's ConfirmDialog: focus
 * starts on Vazgeç and the action button takes the destructive tone. Render
 * `dialog` once, inside the drawer when the action sits in one, so the
 * question opens over it.
 */
export function useConfirm(): [(request: ConfirmRequest) => void, ReactNode] {
  // The last request stays shown while the dialog closes, so its text does not blank out
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [open, setOpen] = useState(false);
  const ask = (next: ConfirmRequest) => {
    setRequest(next);
    setOpen(true);
  };
  const dialog = (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      title={request?.title ?? ''}
      description={request?.description}
      actionLabel={request?.actionLabel ?? ''}
      destructive={request?.destructive ?? true}
      onAction={() => {
        setOpen(false);
        if (request) void request.onConfirm();
      }}
    />
  );
  return [ask, dialog];
}
