'use client';

import {
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useSkylcn,
} from '@skylab-kulubu/skylcn-ui';
import { useId, useRef, useState } from 'react';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { TextArea } from '@/components/chrome/TextArea';
import { ProblemError } from '@/lib/api/core';
import type { CertificateAttendanceRow } from '@/lib/api/certificates';
import { attendedText, JUSTIFICATION_MAX } from '@/lib/certificate-attendance';
import { coreProblemMessage } from '@/lib/core-problems';
import { BUTTON_TEXT, TEXT_SECONDARY } from '@/lib/ui/type-scale';

const FIELD_ERRORS: Record<string, string> = {
  justification_required: 'Gerekçe yaz.',
  justification_too_long: `Gerekçe en çok ${JUSTIFICATION_MAX} karakter olabilir.`,
};

/**
 * "Elle ver" from a row of the attendance list. Below the threshold it asks
 * why (core keeps it with the batch); an eligible row is given without one.
 */
export function ManualIssueDialog({
  row,
  countedTotal,
  sessionless,
  needsReason,
  onClose,
  onIssue,
}: {
  row: CertificateAttendanceRow;
  countedTotal: number;
  /** An event without sessions: the line says whether the person entered (core #422). */
  sessionless?: boolean;
  needsReason: boolean;
  onClose: () => void;
  /** Rejects with core's problem; the dialog says it. */
  onIssue: (justification?: string) => Promise<void>;
}) {
  const { messages } = useSkylcn();
  const fieldId = useId();
  const [reason, setReason] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const running = useRef(false);

  async function submit() {
    if (running.current) return;
    const text = reason.trim();
    if (needsReason && !text) {
      setFieldError(FIELD_ERRORS.justification_required);
      return;
    }
    running.current = true;
    setPending(true);
    setError(null);
    setFieldError(null);
    try {
      await onIssue(text || undefined);
    } catch (cause) {
      const code = cause instanceof ProblemError ? cause.code : undefined;
      if (code && FIELD_ERRORS[code]) setFieldError(FIELD_ERRORS[code]);
      else setError(coreProblemMessage(cause, 'Sertifika kuyruğa alınamadı'));
    } finally {
      running.current = false;
      setPending(false);
    }
  }

  // Core asked for a reason the list did not expect (the marks changed): show the field
  const showReason = needsReason || fieldError !== null;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
    >
      <DialogContent>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <DialogHeader className="pr-5">
            <DialogTitle>Elle sertifika ver</DialogTitle>
            {error ? (
              <p
                role="alert"
                className="border-destructive/30 bg-destructive/10 text-destructive mt-3 rounded-md border px-3 py-2 text-[13px]/5"
              >
                {error}
              </p>
            ) : null}
          </DialogHeader>
          <DialogBody className="space-y-3 pt-0">
            <p className="text-foreground text-sm">
              {row.name}
              <span className={`text-subtle-foreground ms-2 ${TEXT_SECONDARY}`}>
                {attendedText({ countedTotal, sessionless }, row)}
              </span>
            </p>
            {showReason ? (
              <div className="space-y-1">
                <label htmlFor={fieldId} className="block">
                  <FieldLabel>Gerekçe</FieldLabel>
                </label>
                <TextArea
                  id={fieldId}
                  value={reason}
                  maxLength={JUSTIFICATION_MAX}
                  rows={3}
                  placeholder="Raporlu, iki oturumu kaçırdı"
                  aria-invalid={fieldError ? true : undefined}
                  aria-describedby={`${fieldId}-hint`}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (fieldError) setFieldError(null);
                  }}
                />
                <div
                  id={`${fieldId}-hint`}
                  className={`flex items-start justify-between gap-3 ${TEXT_SECONDARY}`}
                >
                  <span role={fieldError ? 'alert' : undefined} className="text-destructive">
                    {fieldError}
                  </span>
                  <span className="text-subtle-foreground tabular-nums">
                    {`${reason.length}/${JUSTIFICATION_MAX}`}
                  </span>
                </div>
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter className="mt-4">
            <DialogClose
              render={<Button className={BUTTON_TEXT} type="button" disabled={pending} />}
            >
              {messages.cancel}
            </DialogClose>
            <Button className={BUTTON_TEXT} type="submit" variant="primary" pending={pending}>
              Ver
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
