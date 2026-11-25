'use client';

import { BulkBar, Button } from '@skylab-kulubu/skylcn-ui';
import { ExternalLink, Send } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '@/components/chrome/Avatar';
import { ListPanel } from '@/components/chrome/ListPanel';
import { StatusChip } from '@/components/chrome/StatusChip';
import {
  formRespondentsApi,
  type FormRespondent,
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

/** The two views of the Unticketed respondents on Katılımcılar. */
export type RespondentView = 'unticketed' | 'formsPending';

const PAGE = 200;
/** How often a send-all job is read while it runs. */
export const RESPONDENT_JOB_POLL_MS = 2000;

type Part = { rows: FormRespondent[]; total: number; nextCursor: string | null };
const EMPTY: Part = { rows: [], total: 0, nextCursor: null };

export type Respondents = {
  /** Accepted in Forms: "Bilet gönderilmedi". */
  accepted: Part;
  /** Pending in Forms: "Forms'ta onay bekliyor". */
  pending: Part;
  /** A gathering of the Event's forms waits or runs. */
  collecting: boolean;
  /** Unread, or a core without the route. */
  available: boolean;
};

/**
 * The Event's Unticketed respondents (core `GET /v1/events/{id}/respondents`), accepted and
 * pending apart. A core without the route (404) or a refusal leaves `available` off: no view.
 */
export function useRespondents(eventId: string, enabled: boolean) {
  const [state, setState] = useState<Respondents>({
    accepted: EMPTY,
    pending: EMPTY,
    collecting: false,
    available: false,
  });

  const reload = useCallback(async () => {
    if (!enabled) return;
    try {
      const [accepted, pending] = await Promise.all([
        formRespondentsApi.list(eventId, { formsStatus: 'accepted', limit: PAGE }),
        formRespondentsApi.list(eventId, { formsStatus: 'pending', limit: PAGE }),
      ]);
      setState({
        accepted: { rows: accepted.items, total: accepted.total, nextCursor: accepted.nextCursor },
        pending: { rows: pending.items, total: pending.total, nextCursor: pending.nextCursor },
        collecting: accepted.collecting || pending.collecting,
        available: true,
      });
    } catch {
      setState((current) => ({ ...current, available: false }));
    }
  }, [eventId, enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const more = useCallback(
    async (status: 'accepted' | 'pending') => {
      const part = state[status];
      if (!part.nextCursor) return;
      const page = await formRespondentsApi.list(eventId, {
        formsStatus: status,
        limit: PAGE,
        after: part.nextCursor,
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
    [eventId, state],
  );

  return { ...state, reload, more };
}

export function respondentName(row: Pick<FormRespondent, 'firstName' | 'lastName' | 'email'>) {
  return `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() || row.email || 'Adsız';
}

/** The answer in Forms' review page. */
export function formsResponseHref(row: Pick<FormRespondent, 'formId' | 'responseId'>): string {
  const origin = formsAdminOrigin().replace(/\/+$/, '');
  return `${origin}/forms/${encodeURIComponent(row.formId)}/responses/${encodeURIComponent(row.responseId)}`;
}

function matches(row: FormRespondent, query: string): boolean {
  const q = query.trim().toLocaleLowerCase('tr-TR');
  if (!q) return true;
  return [row.firstName, row.lastName, row.email]
    .filter(Boolean)
    .some((part) => part.toLocaleLowerCase('tr-TR').includes(q));
}

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
  canSend,
}: {
  eventId: string;
  view: RespondentView;
  query: string;
  respondents: ReturnType<typeof useRespondents>;
  confirm: (request: ConfirmRequest) => void;
  /** After Tickets were written: the lists are read again. */
  onSent: (line: string) => void | Promise<void>;
  canSend: boolean;
}) {
  const part = view === 'unticketed' ? respondents.accepted : respondents.pending;
  const rows = useMemo(() => part.rows.filter((row) => matches(row, query)), [part.rows, query]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [job, setJob] = useState<RespondentTicketJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sendable = view === 'unticketed' && canSend;
  // The page passes a new function each render; the job's timer must not restart for it
  const sent = useRef(onSent);
  sent.current = onSent;

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
          if (next.state === 'done') await sent.current(`Gönderildi: ${resultLine(next)}`);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(formMappingProblem(err, 'Gönderim durumu okunamadı.'));
          setJob((current) => (current ? { ...current, state: 'failed' } : current));
        });
    }, RESPONDENT_JOB_POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [eventId, jobId, running, job]);

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
          setJob({
            jobId: res.jobId,
            state: 'queued',
            recorded: 0,
            waitlisted: 0,
            full: 0,
            skipped: 0,
          });
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

  return (
    <div className="space-y-3">
      {respondents.collecting ? (
        <p role="status" className="text-muted-foreground text-[13px]/5">
          Form yanıtları alınıyor.
        </p>
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
        ) : rows.length ? (
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
              title="Forms’ta onaylanınca gönderilir"
            >
              <Send className="size-3.5" />
              <span className="hidden sm:inline">Bilet gönder</span>
            </Button>
            <a
              href={formsResponseHref(row)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-skylab-300 hover:text-foreground inline-flex items-center gap-1 text-[13px]/5"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Forms’ta aç</span>
              <span className="sr-only"> (yeni sekmede açılır)</span>
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
