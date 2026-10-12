'use client';

import { ConfirmDialog } from '@skylab-kulubu/skylcn-ui';
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
};

function failureText(request: ConfirmRequest, error: unknown): string {
  if (typeof request.failure === 'function') return request.failure(error);
  return coreProblemMessage(error, request.failure ?? DEFAULT_FAILURE);
}

/**
 * Asks before a destructive action with skylcn-ui's ConfirmDialog: focus
 * starts on Vazgeç and the action button takes the destructive tone. The
 * dialog stays open while the action runs, its button pending; a refusal is
 * said inside the dialog, and only a success closes it. Render `dialog`
 * once, inside the drawer when the action sits in one, so the question
 * opens over it.
 */
export function useConfirm(): [(request: ConfirmRequest) => void, ReactNode] {
  // The last request stays shown while the dialog closes, so its text does not blank out
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ask = (next: ConfirmRequest) => {
    setRequest(next);
    setError(null);
    setPending(false);
    setOpen(true);
  };
  const run = async () => {
    if (!request || pending) return;
    setPending(true);
    setError(null);
    try {
      await request.onConfirm();
      setOpen(false);
    } catch (err) {
      setError(failureText(request, err));
    } finally {
      setPending(false);
    }
  };
  const description =
    request?.description || error ? (
      <>
        {request?.description}
        {error ? (
          // Inside the dialog's description: it is what the reader is looking at
          <span
            role="alert"
            className="border-destructive/30 bg-destructive/10 text-destructive mt-3 block rounded-md border px-3 py-2 text-xs"
          >
            {error}
          </span>
        ) : null}
      </>
    ) : undefined;
  const dialog = (
    <ConfirmDialog
      open={open}
      // Vazgeç, Esc and the backdrop wait for a running action: its result belongs here
      onOpenChange={(next) => {
        if (!next && pending) return;
        setOpen(next);
        if (!next) setError(null);
      }}
      title={request?.title ?? ''}
      description={description}
      actionLabel={request?.actionLabel ?? ''}
      destructive={request?.destructive ?? true}
      pending={pending}
      onAction={() => void run()}
    />
  );
  return [ask, dialog];
}
