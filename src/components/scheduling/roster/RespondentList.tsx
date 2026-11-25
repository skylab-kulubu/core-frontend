'use client';

import { BulkBar, Button } from '@skylab-kulubu/skylcn-ui';
import { ExternalLink, Send } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Avatar } from '@/components/chrome/Avatar';
import { ListPanel } from '@/components/chrome/ListPanel';
import { StatusChip } from '@/components/chrome/StatusChip';
import { ProblemError } from '@/lib/api/core';
import {
  formRespondentsApi,
  type FormRespondent,
  type RespondentIncomplete,
  type RespondentSelection,
  type RespondentTicketJob,
  type RespondentTicketResult,
} from '@/lib/api/form-respondents';
import { formsAdminOrigin } from '@/lib/event-forms';
import { formMappingProblem, previewLine } from '@/lib/form-mapping';
import { listStatus } from '@/lib/list-status';
import { formatEntry } from '@/lib/roster-insights';
import { BUTTON_TEXT } from '@/lib/ui/type-scale';
import type { ConfirmRequest } from '@/lib/ui/use-confirm';
import {
  keepRespondentJob,
  keptRespondentJob,
  respondentJobKey,
} from '@/components/scheduling/use-bind-question';

/** The two views of the Unticketed respondents on Katılımcılar. */
export type RespondentView = 'unticketed' | 'formsPending';

const PAGE = 200;
/** How often a send-all job is read while it runs. */
export const RESPONDENT_JOB_POLL_MS = 2000;

type Part = { rows: FormRespondent[]; total: number; nextCursor: string | null };
const EMPTY: Part = { rows: [], total: 0, nextCursor: null };
const NO_INCOMPLETE: RespondentIncomplete = { missingName: 0, missingEmail: 0, noPerson: 0 };

export type Respondents = {
  /** Accepted in Forms: "Bilet gönderilmedi". */
  accepted: Part;
  /** Pending in Forms: "Forms'ta onay bekliyor". */
  pending: Part;
  /** A gathering of the Event's forms waits or runs. */
  collecting: boolean;
  /** Answers the last gatherings kept no row for: no name, no e-mail, nobody. */
  incomplete: RespondentIncomplete;
  /** core has the route (a 404 says it does not). */
  available: boolean;
  /** The last read failed for another reason: said with a retry, the views stay. */
  failed: boolean;
};

/** How long a search waits for the typing to stop. */
const SEARCH_WAIT_MS = 300;

/**
 * The Event's Unticketed respondents (core `GET /v1/events/{id}/respondents`), accepted and
 * pending apart, searched by core (`q`: a guest's name and e-mail). A core without the route
 * (404) leaves `available` off: no view.
 */
export function useRespondents(eventId: string, enabled: boolean) {
  const [state, setState] = useState<Respondents>({
    accepted: EMPTY,
    pending: EMPTY,
    collecting: false,
    incomplete: NO_INCOMPLETE,
    available: false,
    failed: false,
  });
  const [query, setQuery] = useState('');
  const q = query.trim().slice(0, 100);

  const reload = useCallback(async () => {
    if (!enabled) return;
    try {
      const [accepted, pending] = await Promise.all([
        formRespondentsApi.list(eventId, { formsStatus: 'accepted', limit: PAGE, q }),
        formRespondentsApi.list(eventId, { formsStatus: 'pending', limit: PAGE, q }),
      ]);
      setState({
        accepted: { rows: accepted.items, total: accepted.total, nextCursor: accepted.nextCursor },
        pending: { rows: pending.items, total: pending.total, nextCursor: pending.nextCursor },
        collecting: accepted.collecting || pending.collecting,
        incomplete: accepted.incomplete ?? NO_INCOMPLETE,
        available: true,
        failed: false,
      });
    } catch (err) {
      const absent = err instanceof ProblemError && err.status === 404;
      setState((current) => ({
        ...current,
        available: !absent,
        failed: !absent,
      }));
    }
  }, [eventId, enabled, q]);

  useEffect(() => {
    const timer = setTimeout(() => void reload(), q ? SEARCH_WAIT_MS : 0);
    return () => clearTimeout(timer);
  }, [reload, q]);

  const more = useCallback(
    async (status: 'accepted' | 'pending') => {
      const part = state[status];
      if (!part.nextCursor) return;
      const page = await formRespondentsApi.list(eventId, {
        formsStatus: status,
        limit: PAGE,
        after: part.nextCursor,
        q,
      });
      setState((current) => ({
        ...current,
        [status]: {
          rows: [
            ...current[status].rows,
            ...page.items.filter((row) => !current[status].rows.some((r) => r.id === row.id)),
          ],
          total: page.total,
          nextCursor: page.nextCursor,
        },
      }));
    },
    [eventId, state, q],
  );

  return { ...state, reload, more, setQuery };
}

/** "3 yanıtta ad eksik, 1 yanıtta e-posta eksik": what the gatherings could not keep. */
export function incompleteLine(incomplete: RespondentIncomplete): string | null {
  const parts = [
    incomplete.missingName ? `${incomplete.missingName} yanıtta ad eksik` : '',
    incomplete.missingEmail ? `${incomplete.missingEmail} yanıtta e-posta eksik` : '',
    incomplete.noPerson ? `${incomplete.noPerson} yanıtta kişi yok` : '',
  ].filter(Boolean);
  return parts.length ? `${parts.join(', ')}.` : null;
}

export function respondentName(row: Pick<FormRespondent, 'firstName' | 'lastName' | 'email'>) {
  return `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() || row.email || 'Adsız';
}

/** The answer in Forms' review page. */
export function formsResponseHref(row: Pick<FormRespondent, 'formId' | 'responseId'>): string {
  const origin = formsAdminOrigin().replace(/\/+$/, '');
  return `${origin}/forms/${encodeURIComponent(row.formId)}/responses/${encodeURIComponent(row.responseId)}`;
}

const queuedJob = (jobId: string): RespondentTicketJob => ({
  jobId,
  state: 'queued',
  recorded: 0,
  waitlisted: 0,
  full: 0,
  skipped: 0,
});

function resultLine(result: RespondentTicketResult): string {
  return previewLine(result);
}

/**
 * "Bilet gönderilmedi" and "Forms'ta onay bekliyor" on Katılımcılar (core
 * docs/form-respondents.md): a respondent is not a Ticket. An accepted row is sent one by one,
 * chosen or all at once, each time after the preview's counts; a pending row waits for Forms
 * (its button off, a link to the answer).
 */
export function RespondentList({
  eventId,
  view,
  query,
  respondents,
  confirm,
  onSent,
  onRefresh,
  canSend,
}: {
  eventId: string;
  view: RespondentView;
  query: string;
  respondents: ReturnType<typeof useRespondents>;
  confirm: (request: ConfirmRequest) => void;
  /** After Tickets were written: the lists are read again. */
  onSent: (line: string) => void | Promise<void>;
  /** After a send-all job failed: what it wrote is read again. */
  onRefresh?: () => void | Promise<void>;
  canSend: boolean;
}) {
  const part = view === 'unticketed' ? respondents.accepted : respondents.pending;
  const rows = part.rows;
  const jobKey = respondentJobKey(eventId);
  const { setQuery } = respondents;
  // core searches (`q`); the list shows what it answered
  useEffect(() => {
    setQuery(query);
  }, [query, setQuery]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // A send-all sent earlier from this tab shows its progress again
  const [job, setJob] = useState<RespondentTicketJob | null>(() => {
    const kept = typeof window === 'undefined' ? null : keptRespondentJob(jobKey);
    return kept ? queuedJob(kept) : null;
  });
  const [readFailed, setReadFailed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const sendable = view === 'unticketed' && canSend;
  // The page passes new functions each render; the job's timer must not restart for them
  const sent = useRef(onSent);
  sent.current = onSent;
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;

  useEffect(() => {
    setSelected(new Set());
  }, [view]);

  const jobId = job?.jobId;
  const running = job?.state === 'queued' || job?.state === 'running';
  useEffect(() => {
    if (!jobId || !running) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      formRespondentsApi
        .ticketJob(eventId, jobId)
        .then(async (next) => {
          if (cancelled) return;
          setJob(next);
          setReadFailed(0);
          if (next.state === 'done' || next.state === 'failed') keepRespondentJob(jobKey, null);
          if (next.state === 'done') await sent.current(`Gönderildi: ${resultLine(next)}`);
          // Part may have gone through before it failed
          if (next.state === 'failed') await refresh.current?.();
        })
        .catch((err) => {
          if (cancelled) return;
          if (err instanceof ProblemError && err.code === 'ticket_job_not_found') {
            keepRespondentJob(jobKey, null);
            setJob(null);
            return;
          }
          // One read that failed is no failed job: read again
          setReadFailed((n) => n + 1);
        });
    }, RESPONDENT_JOB_POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [eventId, jobId, running, job, jobKey, readFailed]);

  async function ask(selection: RespondentSelection, count: number) {
    setError(null);
    let preview;
    try {
      preview = await formRespondentsApi.previewTickets(eventId, selection);
    } catch (err) {
      setError(formMappingProblem(err, 'Sayılar okunamadı.'));
      return;
    }
    const all = 'all' in selection;
    confirm({
      title: all
        ? 'Bilet gönderilmeyen herkese bilet gönderilsin mi?'
        : count === 1
          ? 'Bilet gönderilsin mi?'
          : `${count} kişiye bilet gönderilsin mi?`,
      description: `${previewLine(preview)}.`,
      actionLabel: 'Biletleri gönder',
      destructive: false,
      failure: (err) => formMappingProblem(err, 'Biletler gönderilemedi.'),
      onConfirm: async () => {
        const res = await formRespondentsApi.sendTickets(eventId, selection);
        if ('jobId' in res) {
          keepRespondentJob(jobKey, res.jobId);
          setJob(queuedJob(res.jobId));
          return;
        }
        setSelected(new Set());
        await onSent(`Gönderildi: ${resultLine(res)}`);
      },
    });
  }

  const status = listStatus({
    loading: false,
    rowCount: rows.length,
    emptyMessage: query.trim()
      ? 'Eşleşen kayıt yok'
      : view === 'unticketed'
        ? 'Bilet bekleyen yok'
        : 'Onay bekleyen yok',
  });

  const incomplete = incompleteLine(respondents.incomplete);

  return (
    <div className="space-y-3">
      {respondents.collecting ? (
        <p role="status" className="text-muted-foreground text-[13px]/5">
          Form yanıtları alınıyor.
        </p>
      ) : null}
      {incomplete ? <p className="text-muted-foreground text-[13px]/5">{incomplete}</p> : null}
      {respondents.failed ? (
        <div role="alert" className="flex flex-wrap items-center gap-2">
          <p className="text-destructive text-[13px]/5">Liste yüklenemedi.</p>
          <Button
            className={BUTTON_TEXT}
            size="xs"
            variant="outline"
            onClick={() => void respondents.reload()}
          >
            Yeniden dene
          </Button>
        </div>
      ) : null}
      {sendable ? (
        selected.size ? (
          <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
            <Button
              className={BUTTON_TEXT}
              size="sm"
              variant="outline"
              onClick={() => void ask({ ids: [...selected] }, selected.size)}
            >
              <Send className="size-4" />
              Bilet gönder
            </Button>
          </BulkBar>
        ) : rows.length && !query.trim() ? (
          <div className="flex justify-end">
            <Button
              className={BUTTON_TEXT}
              size="sm"
              variant="outline"
              disabled={running}
              onClick={() => void ask({ all: true }, part.total)}
            >
              <Send className="size-4" />
              Hepsine gönder
            </Button>
          </div>
        ) : null
      ) : null}
      {job ? (
        <p role="status" className="text-muted-foreground text-[13px]/5">
          {job.state === 'done'
            ? `Gönderildi: ${resultLine(job)}.`
            : job.state === 'failed'
              ? `Gönderim tamamlanamadı: ${resultLine(job)}.`
              : `Biletler gönderiliyor: ${resultLine(job)}.`}
          {readFailed && running ? ' Durum okunamadı, yeniden deneniyor.' : ''}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive text-[13px]/5">
          {error}
        </p>
      ) : null}
      <ListPanel status={status}>
        <ul className="divide-border-subtle divide-y">
          {rows.map((row) => (
            <RespondentRow
              key={row.id}
              row={row}
              sendable={sendable}
              selected={selected.has(row.id)}
              onToggle={() =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(row.id)) next.delete(row.id);
                  else next.add(row.id);
                  return next;
                })
              }
              onSend={() => void ask({ ids: [row.id] }, 1)}
            />
          ))}
        </ul>
      </ListPanel>
      {part.nextCursor ? (
        <div className="flex justify-center">
          <Button
            className={BUTTON_TEXT}
            size="sm"
            variant="outline"
            onClick={() => void respondents.more(view === 'unticketed' ? 'accepted' : 'pending')}
          >
            Daha fazla
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function RespondentRow({
  row,
  sendable,
  selected,
  onToggle,
  onSend,
}: {
  row: FormRespondent;
  sendable: boolean;
  selected: boolean;
  onToggle: () => void;
  onSend: () => void;
}) {
  const name = respondentName(row);
  const pending = row.formsStatus === 'pending';
  const why = useId();
  return (
    <li className="flex items-center gap-3 px-3 py-3">
      {sendable && !pending ? (
        <input
          type="checkbox"
          className="accent-skylab-400 h-3.5 w-3.5 shrink-0"
          checked={selected}
          aria-label={`${name} seç`}
          onChange={onToggle}
        />
      ) : (
        <span className="w-3.5 shrink-0" aria-hidden />
      )}
      <Avatar name={name} email={row.email} size="md" />
      <span className="min-w-0 flex-1">
        <span className="text-foreground-strong block truncate text-sm font-medium">{name}</span>
        <span className="text-subtle-foreground block truncate text-[13px]/5">
          {row.email || '—'}
          {row.submittedAt ? ` · ${formatEntry(row.submittedAt)}` : ''}
        </span>
        <span className="mt-1 flex flex-wrap gap-1 sm:hidden">
          <RespondentChips pending={pending} />
        </span>
      </span>
      <span className="hidden shrink-0 gap-1 sm:flex">
        <RespondentChips pending={pending} />
      </span>
      <div className="flex shrink-0 items-center gap-1">
        {pending ? (
          <>
            <Button
              className={BUTTON_TEXT}
              size="xs"
              variant="outline"
              disabled
              aria-label={`${name}: bilet gönder`}
              aria-describedby={why}
              title="Forms’ta onaylanınca gönderilir"
            >
              <Send className="size-3.5" />
              <span className="hidden sm:inline">Bilet gönder</span>
            </Button>
            <span id={why} className="sr-only">
              Forms’ta onaylanınca gönderilir
            </span>
            <a
              href={formsResponseHref(row)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${name}: yanıtı Forms’ta aç (yeni sekmede açılır)`}
              className="text-skylab-300 hover:text-foreground inline-flex items-center gap-1 text-[13px]/5"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Forms’ta aç</span>
            </a>
          </>
        ) : sendable ? (
          <Button
            className={BUTTON_TEXT}
            size="xs"
            variant="outline"
            onClick={onSend}
            aria-label={`${name}: bilet gönder`}
          >
            <Send className="size-3.5" />
            <span className="hidden sm:inline">Bilet gönder</span>
          </Button>
        ) : null}
      </div>
    </li>
  );
}

/** The two badges: Forms' state and the Ticket's (none sent yet). */
function RespondentChips({ pending }: { pending: boolean }) {
  return (
    <>
      <StatusChip
        kind={pending ? 'pending' : 'active'}
        label={pending ? 'Onay bekliyor' : 'Kabul edildi'}
      />
      <StatusChip kind="neutral" label="Gönderilmedi" />
    </>
  );
}
