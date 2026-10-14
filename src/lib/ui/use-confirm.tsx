'use client';

import { ConfirmDialog, useToast } from '@skylab-kulubu/skylcn-ui';
import { useState, type ReactNode } from 'react';
import { coreProblemMessage } from '@/lib/core-problems';

/** The description's closing line for a removal core can undo. */
export const UNDO_HINT = 'Hemen ardından çıkan bildirimdeki Geri al ile geri getirebilirsin.';

const DEFAULT_FAILURE = 'İşlem tamamlanamadı. Tekrar dene.';

export type ConfirmRequest = {
  /** Names the action and its target: '"Açılış" oturumu silinsin mi?' */
  title: string;
  /** What happens next: who is told, whether it can be undone. */
  description?: string;
  /** A verb for the action, such as "Oturumu sil"; never "Tamam". */
  actionLabel: string;
  /** Off for a confirmed action that removes nothing, such as a retry. */
  destructive?: boolean;
  /**
   * Does the work and says it went through (the success or Geri al toast).
   * A throw keeps the dialog open with `failure` in it.
   */
  onConfirm: () => void | Promise<void>;
  /**
   * What to say in the dialog when `onConfirm` throws: the fallback for the
   * panel's one problem text (core-problems), or a function for another
   * service's wording. core's English title and detail never reach the reader.
   */
  failure?: string | ((error: unknown) => string);
  /**
   * The action closes the drawer the question sits in, so on success that
   * drawer, not this dialog, decides where focus goes.
   */
  closesDrawer?: boolean;
};

function failureText(request: ConfirmRequest, error: unknown): string {
  if (typeof request.failure === 'function') return request.failure(error);
  return coreProblemMessage(error, request.failure ?? DEFAULT_FAILURE);
}

/**
 * Asks before a destructive action with skylcn-ui's ConfirmDialog, one
 * dialog per page that each question reopens. Focus starts on Vazgeç, and
 * the action button takes the destructive tone unless the request turns it off.
 *
 * ConfirmDialog holds the reader while the action runs: Vazgeç is locked and
 * the button shows as pending. A refusal is said inside the dialog, and only
 * a success closes it. If core does not answer in time, the dialog says so
 * and can be closed. The request is not cancelled, because a delete may
 * already have gone through: a late success still shows its toast, and a
 * late refusal after the dialog has closed becomes an error toast here.
 *
 * Only ConfirmDialog closes the dialog (Vazgeç, Esc or a success), never this
 * hook, so a refusal that comes after the reader left always counts as late.
 *
 * Render `dialog` once. When the action sits in a drawer, render it inside
 * the drawer so the question opens over it.
 */
export function useConfirm(): [(request: ConfirmRequest) => void, ReactNode] {
  const { add } = useToast();
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
      // Always a promise, so a synchronous action also closes the dialog once it went through
      onAction={async () => {
        await request?.onConfirm();
      }}
      failureMessage={(error) => (request ? failureText(request, error) : DEFAULT_FAILURE)}
      // The reader left the stalled dialog, maybe for another question: a toast is the only place left
      onLateFailure={(error) =>
        add({
          title: 'İşlem tamamlanamadı',
          description: request ? failureText(request, error) : DEFAULT_FAILURE,
          type: 'error',
          priority: 'high',
        })
      }
    />
  );
  return [ask, dialog];
}
