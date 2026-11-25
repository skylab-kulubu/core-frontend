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
  type RespondentTicketPreview,
} from '@/lib/api/form-respondents';
import { readFormAnswerCounts, type FormAnswerCounts } from '@/lib/api/skyforms';
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
import { useConfirm } from '@/lib/ui/use-confirm';

/** How often a send-all job is read while it runs. */
export const TICKET_JOB_POLL_MS = 2000;

type Load =
  | { state: 'loading' }
  /** No such Event yet (not saved) or a core without the routes: nothing to show. */
  | { state: 'hidden' }
  | { state: 'blocked'; message: string }
  | { state: 'ready'; questions: FormQuestion[]; saved: boolean };

function questionLabel(q: FormQuestion): string {
  const text = q.question.trim() || q.id;
  return text.length > 80 ? `${text.slice(0, 79)}…` : text;
}

/** The bind question: N from Forms (accepted), the counts from core's preview. */
export function bindQuestion(
  counts: FormAnswerCounts | null,
  preview: RespondentTicketPreview | null,
  collecting: boolean,
): { title: string; description: string } | null {
  const fromPreview = preview
    ? preview.tickets + preview.waitlisted + preview.full + preview.alreadyTicketed
    : 0;
  const filled = counts?.accepted ?? fromPreview;
  const pending = counts?.pending ?? preview?.pendingSkipped ?? 0;
  if (!filled && !pending && !collecting) return null;
  const lines: string[] = [];
  if (preview) lines.push(`${previewLine(preview)}.`);
  if (pending) lines.push(`${pending} kişi Forms’ta onay bekliyor.`);
  if (collecting) lines.push('Yanıtlar hâlâ alınıyor; biletler alım bitince gider.');
  return {
    title: `Bu formu ${filled} kişi doldurdu. Hepsini katılımcı olarak ekleyip biletlerini gönderelim mi?`,
    description: lines.join(' '),
  };
}

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
 * again any time.
 */
export function FormMappingPanel({ eventId, formId }: { eventId: string; formId: string }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [mapping, setMapping] = useState<FormMapping>(EMPTY_MAPPING);
  const [guessed, setGuessed] = useState<MappingField[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [job, setJob] = useState<RespondentTicketJob | null>(null);
  const [ask, dialog] = useConfirm();

  useEffect(() => {
    let cancelled = false;
    setLoad({ state: 'loading' });
    setError(null);
    setNote(null);
    setJob(null);
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
        setLoad({ state: 'blocked', message: formMappingProblem(err, 'Sorular okunamadı.') });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, formId]);

  const jobId = job?.jobId;
  const jobRunning = job?.state === 'queued' || job?.state === 'running';
  useEffect(() => {
    if (!jobId || !jobRunning) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      formRespondentsApi
        .ticketJob(eventId, jobId)
        .then((next) => {
          if (!cancelled) setJob(next);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(formMappingProblem(err, 'Gönderim durumu okunamadı.'));
          setJob((current) => (current ? { ...current, state: 'failed' } : current));
        });
    }, TICKET_JOB_POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [eventId, jobId, jobRunning, job]);

  async function askToSend() {
    setAsking(true);
    setError(null);
    setNote(null);
    try {
      const [counts, preview, page] = await Promise.allSettled([
        readFormAnswerCounts(formId),
        formRespondentsApi.previewTickets(eventId, { all: true, formId }),
        formRespondentsApi.list(eventId, { formId, limit: 1 }),
      ]);
      if (preview.status === 'rejected') {
        setError(formMappingProblem(preview.reason, 'Sayılar okunamadı.'));
        return;
      }
      const question = bindQuestion(
        counts.status === 'fulfilled' ? counts.value : null,
        preview.value,
        page.status === 'fulfilled' && page.value.collecting,
      );
      if (!question) {
        setNote('Bilet gönderilecek yanıt yok.');
        return;
      }
      ask({
        ...question,
        actionLabel: 'Biletleri gönder',
        destructive: false,
        failure: (err) => formMappingProblem(err, 'Biletler gönderilemedi.'),
        onConfirm: async () => {
          const res = await formRespondentsApi.sendTickets(eventId, { all: true, formId });
          if ('jobId' in res) {
            setJob({
              jobId: res.jobId,
              state: 'queued',
              recorded: 0,
              waitlisted: 0,
              full: 0,
              skipped: 0,
            });
          }
        },
      });
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
      if (first) await askToSend();
    } catch (err) {
      setError(formMappingProblem(err, 'Eşleme kaydedilemedi.'));
    } finally {
      setSaving(false);
    }
  }

  if (load.state === 'hidden') return null;

  const issue = load.state === 'ready' ? mappingIssue(mapping) : null;

  return (
    <section aria-label="Soru eşleme" className="border-border space-y-3 border-t pt-3">
      <FieldLabel>Soru eşleme</FieldLabel>
      {load.state === 'loading' ? (
        <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>Sorular okunuyor…</p>
      ) : null}
      {load.state === 'blocked' ? (
        <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>{load.message}</p>
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
            <SaveButton
              type="button"
              variant="outline"
              disabled={asking || jobRunning}
              onClick={() => void askToSend()}
            >
              Yanıtlara bilet gönder
            </SaveButton>
          </div>
        </>
      ) : null}
      {job ? (
        <p role="status" className={`text-muted-foreground ${TEXT_SECONDARY}`}>
          {jobLine(job)}
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
