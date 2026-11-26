'use client';

import type { ReactNode } from 'react';
import { formRespondentsApi, type RespondentTicketPreview } from '@/lib/api/form-respondents';
import { readFormAnswerCounts, type FormAnswerCounts } from '@/lib/api/skyforms';
import { formsAdminOrigin, skyformsFormId } from '@/lib/event-forms';
import { formMappingProblem, previewLine } from '@/lib/form-mapping';
import { useConfirm } from '@/lib/ui/use-confirm';

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
  // While the answers are gathered the preview counts only part of them
  if (collecting) lines.push('Yanıtlar alınıyor; biletler alım bitince gider.');
  else if (preview) lines.push(`${previewLine(preview)}.`);
  if (pending) lines.push(`${pending} kişi Forms’ta onay bekliyor.`);
  return {
    title: `Bu formu ${filled} kişi doldurdu. Hepsini katılımcı olarak ekleyip biletlerini gönderelim mi?`,
    description: lines.join(' '),
  };
}

/** Where a send-all job's id is kept, so its progress shows again on coming back. */
export function respondentJobKey(eventId: string, formId?: string): string {
  return `skylab.admin.respondentJob.${eventId}.${formId ?? 'all'}`;
}

/** Keeps (or with null forgets) a running job's id for this tab; a blocked storage keeps none. */
export function keepRespondentJob(key: string, jobId: string | null): void {
  try {
    if (jobId) window.sessionStorage.setItem(key, jobId);
    else window.sessionStorage.removeItem(key);
  } catch {
    // Only the progress line on coming back is lost
  }
}

export function keptRespondentJob(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export type BindAnswer =
  /** Sent: the job's id. */
  | { jobId: string }
  /** The reader said no or closed the question. */
  | { declined: true }
  /** Nobody filled the form. */
  | { none: true }
  /** The counts could not be read: why. */
  | { error: string };

/**
 * Asks whether to send Tickets to everyone who filled the form (core docs/form-respondents.md):
 * after the form's first mapping, and after a save that newly lists a Skyforms form. Resolves
 * once the question is answered; a "yes" queues the send-all job and keeps its id.
 */
export function useBindQuestion(): [
  (eventId: string, formId: string) => Promise<BindAnswer>,
  ReactNode,
] {
  const [confirm, dialog] = useConfirm();

  async function askBind(eventId: string, formId: string): Promise<BindAnswer> {
    const [counts, preview, page] = await Promise.allSettled([
      readFormAnswerCounts(formId),
      formRespondentsApi.previewTickets(eventId, { all: true, formId }),
      formRespondentsApi.list(eventId, { formId, limit: 1 }),
    ]);
    if (preview.status === 'rejected') {
      return { error: formMappingProblem(preview.reason, 'Sayılar okunamadı.') };
    }
    const question = bindQuestion(
      counts.status === 'fulfilled' ? counts.value : null,
      preview.value,
      page.status === 'fulfilled' && page.value.collecting,
    );
    if (!question) return { none: true };
    return new Promise<BindAnswer>((resolve) => {
      confirm({
        ...question,
        actionLabel: 'Biletleri gönder',
        destructive: false,
        failure: (err) => formMappingProblem(err, 'Biletler gönderilemedi.'),
        onCancel: () => resolve({ declined: true }),
        onConfirm: async () => {
          const res = await formRespondentsApi.sendTickets(eventId, { all: true, formId });
          if ('jobId' in res) {
            keepRespondentJob(respondentJobKey(eventId, formId), res.jobId);
            resolve({ jobId: res.jobId });
          } else {
            resolve({ declined: true });
          }
        },
      });
    });
  }

  return [askBind, dialog];
}

/** The Skyforms forms (application and extra) `after` lists that `before` did not. */
export function newlyListedForms(
  before: { formUrl?: string | null; extraFormUrls?: { url: string }[] | null },
  after: { formUrl?: string | null; extraFormUrls?: { url: string }[] | null },
  origin = formsAdminOrigin(),
): string[] {
  const ids = (event: typeof before) =>
    [event.formUrl ?? '', ...(event.extraFormUrls ?? []).map((row) => row.url)]
      .map((url) => skyformsFormId(url, origin))
      .filter((id): id is string => Boolean(id));
  const had = new Set(ids(before));
  return [...new Set(ids(after))].filter((id) => !had.has(id));
}
