'use client';

import {
  Button,
  Checkbox,
  CopyButton,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useSkylcn,
} from '@skylab-kulubu/skylcn-ui';
import { useEffect, useState } from 'react';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { CheckboxRow } from '@/components/scheduling/use-event-status-actions';
import { BUTTON_TEXT, TEXT_SECONDARY } from '@/lib/ui/type-scale';
import type { PasswordResult } from '@/lib/api/user-account';
import { coreProblemMessage } from '@/lib/core-problems';

function DialogError({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p
      role="alert"
      className="border-destructive/30 bg-destructive/10 text-destructive mt-3 rounded-md border px-3 py-2 text-xs"
    >
      {text}
    </p>
  );
}

/**
 * A temporary password: core makes one up, or the reader types one. Once set
 * it is shown here, once; closing the dialog forgets it.
 */
export function TemporaryPasswordDialog({
  open,
  onOpenChange,
  personName,
  onSet,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personName: string;
  onSet: (password?: string) => Promise<PasswordResult>;
}) {
  const { messages } = useSkylcn();
  const [mode, setMode] = useState<'generate' | 'type'>('generate');
  const [typed, setTyped] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PasswordResult | null>(null);
  // A password core made up is shown once: closing before it was copied asks first
  const [copied, setCopied] = useState(false);
  const [askClose, setAskClose] = useState(false);

  useEffect(() => {
    if (!open) {
      // The password leaves memory with the dialog
      setResult(null);
      setTyped('');
      setMode('generate');
      setError(null);
      setCopied(false);
      setAskClose(false);
    }
  }, [open]);

  async function submit() {
    if (mode === 'type' && !typed.trim()) {
      setError('Parolayı yaz.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      setResult(await onSet(mode === 'type' ? typed : undefined));
    } catch (err) {
      setError(coreProblemMessage(err, 'Parola belirlenemedi'));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && pending) return;
        if (!next && result?.password && !copied && !askClose) {
          setAskClose(true);
          return;
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        {result ? (
          <>
            <DialogHeader className="pr-5">
              <DialogTitle>Geçici parola</DialogTitle>
              <DialogDescription>
                {result.generated ? 'Bir kez gösterilir.' : 'Belirlendi.'} İlk girişte değiştirecek.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-3 pt-0">
              {result.password ? (
                <div className="bg-accent border-border-subtle flex items-center gap-2 rounded-lg border px-3 py-2">
                  <code
                    data-testid="temporary-password"
                    className="text-foreground-strong flex-1 font-mono text-lg tracking-wide break-all"
                  >
                    {result.password}
                  </code>
                  <span onClickCapture={() => setCopied(true)}>
                    <CopyButton value={result.password} size="sm" />
                  </span>
                </div>
              ) : null}
              {!result.sessionsClosed ? (
                <p className={`text-warning ${TEXT_SECONDARY}`}>Açık oturumlar kapatılamadı.</p>
              ) : null}
              {askClose ? (
                <p role="alert" className="text-warning text-sm">
                  Parola kopyalanmadı. Kapatınca bir daha görünmez.
                </p>
              ) : null}
            </DialogBody>
            <DialogFooter className="mt-4">
              {askClose ? (
                <>
                  <Button className={BUTTON_TEXT} type="button" onClick={() => setAskClose(false)}>
                    Geri dön
                  </Button>
                  <DialogClose
                    render={<Button className={BUTTON_TEXT} type="button" variant="primary" />}
                  >
                    Yine de kapat
                  </DialogClose>
                </>
              ) : (
                <DialogClose
                  render={<Button className={BUTTON_TEXT} type="button" variant="primary" />}
                >
                  Kapat
                </DialogClose>
              )}
            </DialogFooter>
          </>
        ) : (
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <DialogHeader className="pr-5">
              <DialogTitle>{personName} için geçici parola</DialogTitle>
              <DialogDescription>
                İlk girişte değiştirecek. Açık oturumları kapanır.
              </DialogDescription>
              <DialogError text={error} />
            </DialogHeader>
            <DialogBody className="space-y-3 pt-0">
              <fieldset className="space-y-2 pt-1">
                <legend className="sr-only">Parola</legend>
                <label className="text-secondary-foreground flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="password-mode"
                    checked={mode === 'generate'}
                    onChange={() => setMode('generate')}
                  />
                  Üret
                </label>
                <label className="text-secondary-foreground flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="password-mode"
                    checked={mode === 'type'}
                    onChange={() => setMode('type')}
                  />
                  Ben yazayım
                </label>
              </fieldset>
              {mode === 'type' ? (
                <label className="block space-y-1">
                  <FieldLabel>Parola</FieldLabel>
                  <Field
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                    // Someone else's password: no password manager offers to save or fill it here
                    autoComplete="off"
                    data-1p-ignore=""
                    data-lpignore="true"
                    data-bwignore=""
                    data-form-type="other"
                    spellCheck={false}
                    autoFocus
                  />
                </label>
              ) : null}
            </DialogBody>
            <DialogFooter className="mt-4">
              <DialogClose
                render={<Button className={BUTTON_TEXT} type="button" disabled={pending} />}
              >
                {messages.cancel}
              </DialogClose>
              <Button className={BUTTON_TEXT} type="submit" variant="primary" pending={pending}>
                Parolayı belirle
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** A new e-mail address: it becomes the personal one, the primary when asked. */
export function EmailChangeDialog({
  open,
  onOpenChange,
  current,
  primaryForced = false,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current?: string;
  /** The personal address is the primary (or there is none): the new address becomes it. */
  primaryForced?: boolean;
  onSave: (change: { address: string; verified: boolean; primary: boolean }) => Promise<void>;
}) {
  const { messages } = useSkylcn();
  const [address, setAddress] = useState('');
  const [verified, setVerified] = useState(false);
  const [primary, setPrimary] = useState(primaryForced);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A new key per opening: the boxes start from their defaults again
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (open) {
      setAddress('');
      setVerified(false);
      setPrimary(primaryForced);
      setError(null);
      setRound((value) => value + 1);
    }
  }, [open]);

  async function submit() {
    if (!address.trim()) {
      setError('Adresi yaz.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSave({ address: address.trim(), verified, primary: primaryForced || primary });
      onOpenChange(false);
    } catch (err) {
      setError(coreProblemMessage(err, 'E-posta değiştirilemedi'));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && pending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <DialogHeader className="pr-5">
            <DialogTitle>E-postayı değiştir</DialogTitle>
            {current ? <DialogDescription>Şimdiki: {current}</DialogDescription> : null}
            <DialogError text={error} />
          </DialogHeader>
          <DialogBody key={round} className="space-y-3 pt-0">
            <label className="block space-y-1">
              <FieldLabel>Yeni adres</FieldLabel>
              <Field
                type="email"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                autoComplete="off"
                autoFocus
              />
            </label>
            {primaryForced ? (
              // The person's personal address is the primary: the new one replaces it there
              <label className="text-muted-foreground flex items-center gap-2 text-sm">
                <Checkbox checked disabled />
                Birincil yap
              </label>
            ) : (
              <CheckboxRow label="Birincil yap" defaultChecked={false} onChange={setPrimary} />
            )}
            <CheckboxRow label="Onaylı say" defaultChecked={false} onChange={setVerified} />
          </DialogBody>
          <DialogFooter className="mt-4">
            <DialogClose
              render={<Button className={BUTTON_TEXT} type="button" disabled={pending} />}
            >
              {messages.cancel}
            </DialogClose>
            <Button className={BUTTON_TEXT} type="submit" variant="primary" pending={pending}>
              Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
