'use client';

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useSkylcn,
  useToast,
} from '@skylab-kulubu/skylcn-ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { coreProblemMessage } from '@/lib/core-problems';

/** The description's closing line for a removal core can undo. */
export const UNDO_HINT = 'Hemen ardından çıkan bildirimdeki Geri al ile geri getirebilirsin.';

const DEFAULT_FAILURE = 'İşlem tamamlanamadı. Tekrar dene.';

/** How long the dialog holds the reader before letting them leave a request that has not answered. */
export const CONFIRM_STALL_MS = 25_000;

export const STALLED_TEXT = 'Sunucu yanıt vermedi; sonucu listeden denetle.';

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
   * What the question says after `onConfirm` throws, when that changed: a
   * retry of a partly refused batch names only the ones left.
   */
  afterFailure?: (error: unknown) => Partial<Pick<ConfirmRequest, 'title' | 'description'>> | void;
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
 * Asks before a destructive action. It is skylcn-ui's ConfirmDialog put
 * together from the same Dialog parts and classes, because the dialog needs
 * two things ConfirmDialog cannot do yet: a Vazgeç that is disabled while
 * the action runs, and an error line in the dialog. Focus starts on Vazgeç,
 * and the action button takes the destructive tone.
 *
 * While the action runs the dialog stays open and its button shows as
 * pending. A refusal is said inside the dialog, and only a success closes it.
 * If core does not answer within CONFIRM_STALL_MS the dialog says so and can
 * be closed. The request is not cancelled, because a delete may already have
 * gone through: a late success still shows its toast, and a late refusal
 * after the dialog has closed becomes an error toast.
 *
 * Render `dialog` once. When the action sits in a drawer, render it inside
 * the drawer so the question opens over it.
 */
export function useConfirm(): [(request: ConfirmRequest) => void, ReactNode] {
  const { messages } = useSkylcn();
  const { add } = useToast();
  // The last request stays shown while the dialog closes, so its text does not blank out
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [stalled, setStalled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  // Synchronous guards: a second click in the same batch, and a late answer for an earlier question
  const running = useRef(false);
  const succeeded = useRef(false);
  const run = useRef(0);
  const openRef = useRef(false);
  openRef.current = open;

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setStalled(true), CONFIRM_STALL_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  // Once the wait runs out, Vazgeç is the way out: put the keyboard on it
  useEffect(() => {
    if (stalled) cancel.current?.focus();
  }, [stalled]);

  const close = () => {
    setOpen(false);
    setError(null);
  };

  const ask = (next: ConfirmRequest) => {
    run.current += 1;
    running.current = false;
    succeeded.current = false;
    setRequest(next);
    setError(null);
    setPending(false);
    setStalled(false);
    setOpen(true);
  };

  const confirm = async () => {
    if (!request || running.current) return;
    running.current = true;
    const id = run.current;
    setPending(true);
    setStalled(false);
    setError(null);
    try {
      await request.onConfirm();
      if (id === run.current) {
        succeeded.current = true;
        setOpen(false);
      }
    } catch (err) {
      const text = failureText(request, err);
      if (id === run.current && openRef.current) {
        const next = request.afterFailure?.(err);
        if (next) setRequest({ ...request, ...next });
        setError(text);
      }
      // The reader left the stalled dialog, maybe for another question: a toast is the only place left
      else
        add({ title: 'İşlem tamamlanamadı', description: text, type: 'error', priority: 'high' });
    } finally {
      if (id === run.current) {
        running.current = false;
        setPending(false);
        setStalled(false);
      }
    }
  };

  // Until core answers or stalls, the reader cannot leave: the result belongs here
  const locked = pending && !stalled;
  const alert = error ?? (stalled ? STALLED_TEXT : null);
  const dialog = (
    <Dialog
      open={open}
      // Like ConfirmDialog (an alert dialog): a click outside never closes the question
      disablePointerDismissal
      onOpenChange={(next) => {
        if (next) setOpen(true);
        else if (!locked) close();
      }}
    >
      <DialogContent
        hideClose
        role="alertdialog"
        data-slot="confirm-dialog"
        initialFocus={cancel}
        finalFocus={() => !(succeeded.current && request?.closesDrawer)}
      >
        <DialogHeader className="pr-5">
          <DialogTitle>{request?.title ?? ''}</DialogTitle>
          {request?.description ? (
            <DialogDescription>{request.description}</DialogDescription>
          ) : null}
          {alert ? (
            <p
              role="alert"
              className="border-destructive/30 bg-destructive/10 text-destructive mt-3 rounded-md border px-3 py-2 text-xs"
            >
              {alert}
            </p>
          ) : null}
        </DialogHeader>
        <DialogFooter className="mt-4">
          <DialogClose
            render={<Button ref={cancel} disabled={locked} aria-disabled={locked || undefined} />}
          >
            {messages.cancel}
          </DialogClose>
          <Button
            variant={(request?.destructive ?? true) ? 'destructive' : 'primary'}
            pending={pending}
            onClick={() => void confirm()}
          >
            {request?.actionLabel ?? ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  return [ask, dialog];
}
