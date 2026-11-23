'use client';

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Button, buttonVariants, cn, TaskPage } from '@skylab-kulubu/skylcn-ui';
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Inbox,
  QrCode,
  ScanLine,
  Search,
  Undo2,
  UserCheck,
} from 'lucide-react';
import Link from 'next/link';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { PageSkeleton } from '@/components/chrome/PageSkeleton';
import { Select } from '@/components/chrome/Select';
import { StateCard } from '@/components/chrome/StateCard';
import { useChromeCrumbName } from '@/components/layout/chrome-crumb-names';
import { DoorScanner, canScanWithCamera } from '@/components/scheduling/DoorScanner';
import { GuestDoorQr } from '@/components/scheduling/GuestDoorQr';
import { ProblemError } from '@/lib/api/core';
import { coreProblemMessage } from '@/lib/core-problems';
import { eventDaysApi } from '@/lib/api/eventDays';
import { type EventSession } from '@/lib/api/sessions';
import { ticketsApi, type DoorAttendee, type DoorEvent } from '@/lib/api/tickets';
import {
  ALREADY_CHECKED_IN,
  defaultDoorSessionId,
  doorSessionLabel,
  doorSessionTiming,
} from '@/lib/door-check-in';
import { eventTabHref } from '@/lib/event-workspace';
import { formatApplicantWhen } from '@/lib/tickets-ui';
import { BUTTON_TEXT, TEXT_SECONDARY } from '@/lib/ui/type-scale';

type Entry = { id: string; name: string; createdAt: string };

/** What the last attempt came to, in one large band (pretixSCAN): in, already in, or not. */
type Outcome =
  | { kind: 'in'; entry: Entry }
  | { kind: 'undone'; name: string }
  | { kind: 'already'; text: string }
  | { kind: 'refused'; text: string };

const RECENT = 10;
const SUGGESTIONS = 6;

const clock = new Intl.DateTimeFormat('tr-TR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Istanbul',
});
const timeOf = (iso: string) => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? '' : clock.format(at);
};

/** A refusal in the door's words: already in, nobody found, or core's Turkish reason. */
function refusal(err: unknown, fallback: string): Outcome {
  if (err instanceof ProblemError && err.status === 409) {
    return { kind: 'already', text: coreProblemMessage(err, fallback, ALREADY_CHECKED_IN) };
  }
  if (err instanceof ProblemError && err.status === 404) {
    return { kind: 'refused', text: 'Bulunamadı. Adı, e-postayı ya da bilet kodunu denetle.' };
  }
  return { kind: 'refused', text: coreProblemMessage(err, fallback, ALREADY_CHECKED_IN) };
}

function OutcomeBand({
  outcome,
  undoing,
  onUndo,
}: {
  outcome: Outcome | null;
  undoing: boolean;
  onUndo: (entry: Entry) => void;
}) {
  // Always mounted, so each new line is read out
  return (
    <div role="status" aria-label="Giriş sonucu" aria-live="polite">
      {outcome ? (
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl border p-4',
            outcome.kind === 'in' && 'border-success/50 bg-success/15',
            outcome.kind === 'undone' && 'border-border bg-muted',
            outcome.kind === 'already' && 'border-warning/50 bg-warning/15',
            outcome.kind === 'refused' && 'border-destructive/50 bg-destructive/15',
          )}
        >
          {outcome.kind === 'in' ? (
            <CheckCircle2 className="text-success size-8 shrink-0" aria-hidden />
          ) : outcome.kind === 'undone' ? (
            <Undo2 className="text-muted-foreground size-8 shrink-0" aria-hidden />
          ) : (
            <CircleAlert
              className={cn(
                'size-8 shrink-0',
                outcome.kind === 'already' ? 'text-warning' : 'text-destructive',
              )}
              aria-hidden
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-foreground-strong text-lg leading-tight font-semibold">
              {outcome.kind === 'in'
                ? 'Girdi'
                : outcome.kind === 'undone'
                  ? 'Geri alındı'
                  : outcome.kind === 'already'
                    ? 'Zaten girmiş'
                    : 'Girmedi'}
            </p>
            <p className={cn('text-secondary-foreground break-words', TEXT_SECONDARY)}>
              {outcome.kind === 'in'
                ? `${outcome.entry.name} · ${timeOf(outcome.entry.createdAt)}`
                : outcome.kind === 'undone'
                  ? outcome.name
                  : outcome.text}
            </p>
          </div>
          {outcome.kind === 'in' ? (
            <Button
              variant="outline"
              size="lg"
              className={BUTTON_TEXT}
              disabled={undoing}
              onClick={() => onUndo(outcome.entry)}
            >
              <Undo2 aria-hidden />
              Geri al
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The door of one event, a focus page without the sidebar: the session and its count on top,
 * one box for a name, an e-mail or a ticket code (or the camera), a large result band that can
 * take the entry back, the guest QR and the last entries.
 */
export function DoorDesk({ eventId }: { eventId: string }) {
  const [events, setEvents] = useState<DoorEvent[]>([]);
  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [recent, setRecent] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<DoorAttendee[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [guestQr, setGuestQr] = useState(false);
  const [camera, setCamera] = useState(false);

  useEffect(() => setCamera(canScanWithCamera()), []);

  // The doors and the event's days in one round: the event is in the address
  useEffect(() => {
    let cancelled = false;
    const doors = ticketsApi.listDoorEvents();
    const days = eventDaysApi.listByEvent(eventId);
    doors
      .then(async (rows) => {
        if (cancelled) return;
        setEvents(rows);
        if (!rows.some((row) => row.id === eventId)) return;
        try {
          const listed = await days;
          const nested = await Promise.all(listed.map((day) => eventDaysApi.listSessions(day.id)));
          if (cancelled) return;
          const flat = nested.flat();
          setSessions(flat);
          setSessionId(defaultDoorSessionId(flat));
        } catch (err) {
          if (!cancelled) setError(coreProblemMessage(err, 'Oturumlar yüklenemedi'));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(coreProblemMessage(err, 'Etkinlikler yüklenemedi'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    // A refused days read for a door that is not the person's says nothing
    days.catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const event = events.find((row) => row.id === eventId);
  useChromeCrumbName(`/events/${eventId}`, event?.name);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    try {
      const activity = await ticketsApi.doorActivity(sessionId);
      setTotal(activity.total);
      setActivityError(null);
      setRecent(
        activity.items
          .slice(0, RECENT)
          .map((item) => ({ id: item.id, name: item.personName, createdAt: item.createdAt })),
      );
    } catch (err) {
      setActivityError(coreProblemMessage(err, 'Son girişler yüklenemedi'));
    }
  }, [sessionId]);

  useEffect(() => {
    setRecent([]);
    setTotal(0);
    setActivityError(null);
    setOutcome(null);
    if (!sessionId) return;
    let live = true;
    void refresh();
    const timer = window.setInterval(() => {
      if (live) void refresh();
    }, 5000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [sessionId, refresh]);

  // Names as the door types: the people and guests of this event, from two letters on
  useEffect(() => {
    const typed = query.trim();
    if (typed.length < 2 || !event) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      ticketsApi
        .searchDoorAttendees(eventId, typed)
        .then((rows) => {
          if (!cancelled) setSuggestions(rows.slice(0, SUGGESTIONS));
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, eventId, event]);

  function admitted(entry: Entry) {
    setOutcome({ kind: 'in', entry });
    setRecent((rows) => [entry, ...rows.filter((row) => row.id !== entry.id)].slice(0, RECENT));
    setTotal((count) => count + 1);
    setQuery('');
    setSuggestions([]);
  }

  async function checkIn(target: { personId?: string; query?: string }, label: string) {
    if (!sessionId || busy) return;
    setBusy(true);
    try {
      const created = await ticketsApi.resolveAndCheckIn(sessionId, target);
      admitted({ id: created.id, name: created.personName || label, createdAt: created.createdAt });
    } catch (err) {
      setOutcome(refusal(err, 'Giriş yazılamadı'));
    } finally {
      setBusy(false);
      document.getElementById('door-query')?.focus();
    }
  }

  async function scanned(token: string) {
    if (!sessionId || scanning) return;
    setScanning(true);
    try {
      const created = await ticketsApi.scanCheckIn(sessionId, token);
      admitted({ id: created.id, name: 'Bilet okundu', createdAt: created.createdAt });
      void refresh();
    } catch (err) {
      setOutcome(refusal(err, 'Kod okunamadı'));
    } finally {
      setScanning(false);
    }
  }

  async function undo(entry: Entry) {
    if (!sessionId || undoing) return;
    setUndoing(true);
    try {
      await ticketsApi.undoCheckIn(sessionId, entry.id);
      setOutcome({ kind: 'undone', name: entry.name });
      setRecent((rows) => rows.filter((row) => row.id !== entry.id));
      setTotal((count) => Math.max(0, count - 1));
      void refresh();
    } catch (err) {
      setOutcome({ kind: 'refused', text: coreProblemMessage(err, 'Geri alınamadı') });
    } finally {
      setUndoing(false);
    }
  }

  function submit(form: FormEvent) {
    form.preventDefault();
    const typed = query.trim();
    if (!typed) {
      setOutcome({ kind: 'refused', text: 'Ad, e-posta ya da bilet kodu yaz.' });
      return;
    }
    void checkIn({ query: typed }, typed);
  }

  const selectedSession = sessions.find((session) => session.id === sessionId);
  // Never blocks: says why nothing is chosen, or that the chosen session is not running now
  const sessionNote =
    !sessionId && sessions.length > 0
      ? 'Şu an süren oturum yok; giriş oturumunu seç.'
      : doorSessionTiming(selectedSession);

  // Back to the event on top: the door is reached from it, and left for it
  const shell = (body: ReactNode) => (
    <TaskPage
      title="Kapı"
      size="lg"
      framed={false}
      className="sm:justify-start"
      brand={
        <Link
          href={eventTabHref(eventId)}
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            BUTTON_TEXT,
            '-ml-2 max-w-full',
          )}
        >
          <ArrowLeft aria-hidden />
          <span className="truncate">{event?.name ?? 'Etkinliğe dön'}</span>
        </Link>
      }
    >
      {body}
    </TaskPage>
  );

  if (loading) return shell(<PageSkeleton variant="detail" />);

  if (error && events.length === 0) {
    return shell(
      <div role="alert">
        <StateCard title={error} tone="danger" />
      </div>,
    );
  }

  if (!event) {
    return shell(<StateCard title="Bu etkinliğin kapısında görevin yok" Icon={Inbox} />);
  }

  return shell(
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="block space-y-1">
          <FieldLabel>Oturum</FieldLabel>
          <Select
            value={sessionId}
            onChange={(change) => setSessionId(change.target.value)}
            aria-describedby={sessionNote ? 'door-session-note' : undefined}
            className="h-11"
          >
            <option value="">Oturum seç</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {doorSessionLabel(session)}
              </option>
            ))}
          </Select>
        </label>
        <Button
          variant={guestQr ? 'primary' : 'outline'}
          size="lg"
          className={BUTTON_TEXT}
          disabled={!sessionId}
          aria-pressed={guestQr}
          onClick={() => setGuestQr((open) => !open)}
        >
          <QrCode aria-hidden />
          Misafir QR’ı
        </Button>
      </div>
      {sessionNote ? (
        <p id="door-session-note" className={cn('text-muted-foreground', TEXT_SECONDARY)}>
          {sessionNote}
        </p>
      ) : null}

      <div
        role="status"
        aria-label="Giren sayısı"
        className="border-border-subtle bg-card flex items-end justify-between gap-3 rounded-xl border p-4"
      >
        <div className="min-w-0">
          <p className={cn('text-muted-foreground truncate', TEXT_SECONDARY)}>
            {selectedSession ? selectedSession.title : 'Oturum seçilmedi'}
          </p>
          <p className="text-foreground-strong text-4xl leading-none font-semibold tabular-nums">
            {sessionId ? total : '—'}
          </p>
        </div>
        <p className={cn('text-muted-foreground', TEXT_SECONDARY)}>giren</p>
      </div>

      {guestQr ? <GuestDoorQr sessionId={sessionId} open /> : null}

      <form className="space-y-2" noValidate onSubmit={submit} role="search">
        <label className="block space-y-1">
          <FieldLabel>Kişi ya da bilet</FieldLabel>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="text-subtle-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden
              />
              <Field
                id="door-query"
                type="search"
                inputMode="search"
                autoComplete="off"
                enterKeyHint="go"
                placeholder="Ad, e-posta, bilet kodu"
                value={query}
                onChange={(change) => setQuery(change.target.value)}
                disabled={!sessionId}
                className="h-11 pl-9 text-base"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className={BUTTON_TEXT}
              disabled={!sessionId || busy}
            >
              <UserCheck aria-hidden />
              {busy ? 'Yazılıyor…' : 'Girişi yaz'}
            </Button>
          </div>
        </label>
        {camera && !scanning ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className={cn(BUTTON_TEXT, 'w-full')}
            disabled={!sessionId}
            onClick={() => setScanning(true)}
          >
            <ScanLine aria-hidden />
            Kamerayla tara
          </Button>
        ) : null}
      </form>
      {scanning && sessionId ? (
        <DoorScanner onScan={(value) => void scanned(value)} onClose={() => setScanning(false)} />
      ) : null}

      <OutcomeBand outcome={outcome} undoing={undoing} onUndo={(entry) => void undo(entry)} />

      {suggestions.length ? (
        <ul
          aria-label="Eşleşen kişiler"
          className="border-border-subtle bg-card divide-border-subtle divide-y overflow-hidden rounded-lg border"
        >
          {suggestions.map((attendee) => (
            <li key={attendee.personId ?? attendee.email}>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void checkIn(
                    attendee.personId
                      ? { personId: attendee.personId }
                      : { query: attendee.email || attendee.name },
                    attendee.name,
                  )
                }
                className="hover:bg-accent focus-visible:ring-ring flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left outline-hidden focus-visible:ring-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block truncate text-sm font-medium">
                    {attendee.name}
                  </span>
                  <span className={cn('text-subtle-foreground block truncate', TEXT_SECONDARY)}>
                    {attendee.email}
                  </span>
                </span>
                <span className={cn('text-skylab-300 shrink-0 font-medium', TEXT_SECONDARY)}>
                  Girişi yaz
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <section aria-label="Son girişler" className="space-y-2">
        <h2 className="text-foreground text-sm font-semibold">Son girişler</h2>
        {activityError ? (
          <p role="alert" className="text-destructive text-sm">
            {activityError}
          </p>
        ) : null}
        {recent.length ? (
          <ul className="border-border-subtle bg-card divide-border-subtle divide-y overflow-hidden rounded-lg border">
            {recent.map((row) => (
              <li key={row.id} className="flex min-h-12 items-center gap-3 px-3 py-2">
                <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block truncate text-sm">{row.name}</span>
                  <span className={cn('text-subtle-foreground block', TEXT_SECONDARY)}>
                    {formatApplicantWhen(row.createdAt)}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className={BUTTON_TEXT}
                  disabled={undoing}
                  aria-label={`${row.name}: girişi geri al`}
                  onClick={() => void undo(row)}
                >
                  <Undo2 aria-hidden />
                  Geri al
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={cn('text-subtle-foreground', TEXT_SECONDARY)}>
            {sessionId ? 'Bu oturumda henüz giriş yok' : 'Oturum seç'}
          </p>
        )}
      </section>
    </div>,
  );
}
