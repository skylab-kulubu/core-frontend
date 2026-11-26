'use client';

import { useEffect, useState } from 'react';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Select } from '@/components/chrome/Select';
import { StatusChip } from '@/components/chrome/StatusChip';
import { ProblemError } from '@/lib/api/core';
import {
  formRespondentsApi,
  type FormMapping,
  type FormQuestion,
  type RespondentTicketJob,
} from '@/lib/api/form-respondents';
import {
  EMPTY_MAPPING,
  MAPPING_FIELDS,
  formMappingProblem,
  guessMapping,
  mappableQuestion,
  mappingIssue,
  previewLine,
  type MappingField,
} from '@/lib/form-mapping';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import {
  keepRespondentJob,
  keptRespondentJob,
  respondentJobKey,
  useBindQuestion,
  type BindAnswer,
} from './use-bind-question';

export { bindQuestion } from './use-bind-question';

/** How often a send-all job is read while it runs (and again after a failed read). */
export const TICKET_JOB_POLL_MS = 2000;

/** Refusals after which the form is not the Event's (yet): nothing to send. */
const NOT_LISTED = new Set(['form_not_listed', 'form_not_found']);

type Load =
  | { state: 'loading' }
  /** No such Event yet (not saved) or a core without the routes: nothing to show. */
  | { state: 'hidden' }
  | { state: 'blocked'; message: string; code?: string }
  | { state: 'ready'; questions: FormQuestion[]; saved: boolean };

function questionLabel(q: FormQuestion): string {
  const text = q.question.trim() || q.id;
  return text.length > 80 ? `${text.slice(0, 79)}…` : text;
}

const queued = (jobId: string): RespondentTicketJob => ({
  jobId,
  state: 'queued',
  recorded: 0,
  waitlisted: 0,
  full: 0,
  skipped: 0,
});

export function jobLine(job: RespondentTicketJob): string {
  const counts = previewLine(job);
  if (job.state === 'done') return `Gönderildi: ${counts}.`;
  if (job.state === 'failed') return `Gönderim tamamlanamadı: ${counts}.`;
  return `Biletler gönderiliyor: ${counts}.`;
}

/**
 * The question mapping of an Event's Skyforms form (core docs/form-mappings.md): which question
 * holds the guest's first name, last name, full name and e-mail. The boxes start from the panel's
 * guess (marked "tahmin") until a mapping is saved. The first save asks whether to send Tickets
 * to everyone who filled the form (core docs/form-respondents.md); "Yanıtlara bilet gönder" asks
 * again any time. Both only for who may edit the Event or add attendees (core: Update || Assign),
 * also when Forms lets the reader only view the form.
 */
export function FormMappingPanel({
  eventId,
  formId,
  canSend = false,
}: {
  eventId: string;
  formId: string;
  /** Who may edit the Event or add attendees to it (core: Update || Assign). */
  canSend?: boolean;
}) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [mapping, setMapping] = useState<FormMapping>(EMPTY_MAPPING);
  const [guessed, setGuessed] = useState<MappingField[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [job, setJob] = useState<RespondentTicketJob | null>(null);
  const [readFailed, setReadFailed] = useState(0);
  const [askBind, dialog] = useBindQuestion();
  const jobKey = respondentJobKey(eventId, formId);

  useEffect(() => {
    let cancelled = false;
    setLoad({ state: 'loading' });
    setError(null);
    setNote(null);
    // A job sent earlier from this tab shows its progress again
    const kept = keptRespondentJob(jobKey);
    setJob(kept ? queued(kept) : null);
    void (async () => {
      try {
        const [read, saved] = await Promise.all([
          formRespondentsApi.questions(eventId, formId),
          formRespondentsApi.mapping(eventId, formId).catch((err) => {
            if (err instanceof ProblemError && err.code === 'mapping_not_found') return null;
            throw err;
          }),
        ]);
        if (cancelled) return;
        const questions = (read.questions ?? []).filter(mappableQuestion);
        if (saved) {
          setMapping({
            firstName: saved.firstName ?? null,
            lastName: saved.lastName ?? null,
            fullName: saved.fullName ?? null,
            email: saved.email ?? null,
          });
          setGuessed([]);
        } else {
          const guess = guessMapping(questions, read.suggestion ?? {});
          setMapping(guess.mapping);
          setGuessed(guess.guessed);
        }
        setLoad({ state: 'ready', questions, saved: Boolean(saved) });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ProblemError && err.status === 404 && !err.code) {
          setLoad({ state: 'hidden' });
          return;
        }
        setLoad({
          state: 'blocked',
          message: formMappingProblem(err, 'Sorular okunamadı.'),
          code: err instanceof ProblemError ? err.code : undefined,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, formId, jobKey]);

  const jobId = job?.jobId;
  const jobRunning = job?.state === 'queued' || job?.state === 'running';
  useEffect(() => {
    if (!jobId || !jobRunning) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      formRespondentsApi
        .ticketJob(eventId, jobId)
        .then((next) => {
          if (cancelled) return;
          setJob(next);
          setReadFailed(0);
          if (next.state === 'done' || next.state === 'failed') keepRespondentJob(jobKey, null);
        })
        .catch((err) => {
          if (cancelled) return;
          // Gone (30 days on, or another core): nothing left to follow
          if (err instanceof ProblemError && err.code === 'ticket_job_not_found') {
            keepRespondentJob(jobKey, null);
            setJob(null);
            return;
          }
          // One read that failed is no failed job: read again
          setReadFailed((n) => n + 1);
        });
    }, TICKET_JOB_POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [eventId, jobId, jobRunning, job, jobKey, readFailed]);

  function took(answer: BindAnswer) {
    if ('jobId' in answer) setJob(queued(answer.jobId));
    else if ('error' in answer) setError(answer.error);
    else if ('none' in answer) setNote('Bilet gönderilecek yanıt yok.');
  }

  async function askToSend(keepNote = false) {
    setAsking(true);
    setError(null);
    if (!keepNote) setNote(null);
    try {
      took(await askBind(eventId, formId));
    } finally {
      setAsking(false);
    }
  }

  async function save() {
    if (load.state !== 'ready') return;
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      await formRespondentsApi.saveMapping(eventId, formId, mapping);
      const first = !load.saved;
      setLoad({ ...load, saved: true });
      setGuessed([]);
      setNote('Eşleme kaydedildi.');
      if (first && canSend) await askToSend(true);
    } catch (err) {
      setError(formMappingProblem(err, 'Eşleme kaydedilemedi.'));
    } finally {
      setSaving(false);
    }
  }

  if (load.state === 'hidden') return null;

  const issue = load.state === 'ready' ? mappingIssue(mapping) : null;
  // A viewer in Forms may still send: core decides by the Event's Ticket rights
  const sendable =
    canSend &&
    (load.state === 'ready' || (load.state === 'blocked' && !NOT_LISTED.has(load.code ?? '')));
  const sendButton = sendable ? (
    <SaveButton
      type="button"
      variant="outline"
      disabled={asking || jobRunning}
      onClick={() => void askToSend()}
    >
      Yanıtlara bilet gönder
    </SaveButton>
  ) : null;

  return (
    <section aria-label="Soru eşleme" className="border-border space-y-3 border-t pt-3">
      <FieldLabel>Soru eşleme</FieldLabel>
      {load.state === 'loading' ? (
        <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>Sorular okunuyor…</p>
      ) : null}
      {load.state === 'blocked' ? (
        <>
          <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>{load.message}</p>
          {sendButton}
        </>
      ) : null}
      {load.state === 'ready' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {MAPPING_FIELDS.map(({ field, label }) => (
              <label key={field} className="block space-y-1">
                <span className="flex items-center gap-2">
                  <FieldLabel>{label}</FieldLabel>
                  {guessed.includes(field) ? <StatusChip kind="neutral" label="tahmin" /> : null}
                </span>
                <Select
                  value={mapping[field] ?? ''}
                  onChange={(e) => {
                    setMapping({ ...mapping, [field]: e.target.value || null });
                    setGuessed(guessed.filter((row) => row !== field));
                  }}
                >
                  <option value="">Yok</option>
                  {load.questions.map((q) => (
                    <option key={q.id} value={q.id}>
                      {questionLabel(q)}
                    </option>
                  ))}
                </Select>
              </label>
            ))}
          </div>
          {issue ? <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>{issue}</p> : null}
          <div className="flex flex-wrap gap-2">
            <SaveButton
              type="button"
              disabled={Boolean(issue) || saving}
              onClick={() => void save()}
            >
              {saving ? 'Kaydediliyor…' : 'Eşlemeyi kaydet'}
            </SaveButton>
            {sendButton}
          </div>
        </>
      ) : null}
      {job ? (
        <p role="status" className={`text-muted-foreground ${TEXT_SECONDARY}`}>
          {jobLine(job)}
          {readFailed && jobRunning ? ' Durum okunamadı, yeniden deneniyor.' : ''}
        </p>
      ) : null}
      {note ? (
        <p role="status" className={`text-muted-foreground ${TEXT_SECONDARY}`}>
          {note}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className={`text-destructive ${TEXT_SECONDARY}`}>
          {error}
        </p>
      ) : null}
      {dialog}
    </section>
  );
}
