'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
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
  Volume2,
  VolumeX,
} from 'lucide-react';
import Link from 'next/link';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { PageSkeleton } from '@/components/chrome/PageSkeleton';
import { Select } from '@/components/chrome/Select';
import { StateCard } from '@/components/chrome/StateCard';
import { useChromeCrumbName } from '@/components/layout/chrome-crumb-names';
import { DoorFlash, type DoorFlashResult } from '@/components/scheduling/DoorFlash';
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
  doorConflict,
  doorSessionLabel,
  doorSessionTiming,
  scanRefusal,
} from '@/lib/door-check-in';
import {
  DOOR_FLASH_MS,
  doorSoundOn,
  primeDoorSound,
  setDoorSoundOn,
  signalDoor,
  type DoorSignal,
} from '@/lib/door-feedback';
import { eventTabHref } from '@/lib/event-workspace';
import { formatApplicantWhen } from '@/lib/tickets-ui';
import { BUTTON_TEXT, TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { useDeferredUndo } from '@/lib/ui/use-deferred-undo';

type Entry = { id: string; name: string; createdAt: string };

/** What the last attempt came to, in one large band (pretixSCAN): in, already in, or not. */
type Outcome =
  | { kind: 'in'; entry: Entry }
  | { kind: 'undone'; name: string }
  | { kind: 'already'; text: string; title?: string }
  | { kind: 'refused'; text: string; title?: string };

/** The full-screen result of a scan, tied to its entry so the name can arrive after it. */
type Flash = DoorFlashResult & { entryId?: string };

const RECENT = 10;
const SUGGESTIONS = 6;
/** What the band says for a code the camera read until core's list names its holder. */
const SCANNED = 'Bilet okundu';

const clock = new Intl.DateTimeFormat('tr-TR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Istanbul',
});
const timeOf = (iso: string) => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? '' : clock.format(at);
};

/**
 * A refusal in the door's words: already in (amber), a cancelled or waitlisted ticket, two
 * people of that name, nobody found, or core's Turkish reason (red).
 */
function refusal(err: unknown, fallback: string): Outcome {
  const conflict = doorConflict(err);
  if (conflict?.kind === 'already') return { kind: 'already', text: conflict.text };
  if (conflict) return { kind: 'refused', title: conflict.title, text: conflict.text };
  if (err instanceof ProblemError && err.status === 404) {
    return { kind: 'refused', text: 'Bulunamadı. Adı, e-postayı ya da bilet kodunu denetle.' };
  }
  return { kind: 'refused', text: coreProblemMessage(err, fallback, ALREADY_CHECKED_IN) };
}

function OutcomeBand({
  outcome,
  waiting,
  onUndo,
  onKeep,
}: {
  outcome: Outcome | null;
  /** The entries taken back but still waiting for Vazgeç. */
  waiting: ReadonlySet<string>;
  onUndo: (entry: Entry) => void;
  onKeep: (entry: Entry) => void;
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
                    ? (outcome.title ?? 'Zaten girmiş')
                    : (outcome.title ?? 'Girmedi')}
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
            waiting.has(outcome.entry.id) ? (
              <Button
                variant="outline"
                size="lg"
                className={BUTTON_TEXT}
                aria-label="Geri almaktan vazgeç"
                onClick={() => onKeep(outcome.entry)}
              >
                Vazgeç
              </Button>
            ) : (
              <Button
                variant="outline"
                size="lg"
                className={BUTTON_TEXT}
                onClick={() => onUndo(outcome.entry)}
              >
                <Undo2 aria-hidden />
                Geri al
              </Button>
            )
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
  // The camera stays open between codes; a code read while the last one is being written waits
  const [cameraOpen, setCameraOpen] = useState(false);
  const scanBusy = useRef(false);
  const [guestQr, setGuestQr] = useState(false);
  const [camera, setCamera] = useState(false);
  const [flash, setFlash] = useState<Flash | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [soundOn, setSoundOn] = useState(true);
  const deferred = useDeferredUndo();
  // The session the desk shows now, for answers that arrive after it was changed
  const shownSession = useRef(sessionId);
  shownSession.current = sessionId;

  useEffect(() => setCamera(canScanWithCamera()), []);
  useEffect(() => setSoundOn(doorSoundOn()), []);
  useEffect(() => () => clearTimeout(flashTimer.current), []);
  // An iPhone stops the page's sound when the screen locks or another app comes up: wake it
  // when the door comes back into view (the next tap on the result wakes it too)
  useEffect(() => {
    const wake = () => {
      if (document.visibilityState === 'visible') primeDoorSound();
    };
    document.addEventListener('visibilitychange', wake);
    return () => document.removeEventListener('visibilitychange', wake);
  }, []);

  /** A vibration and a beep for each result; a scan's also covers the screen for a moment. */
  function signal(kind: DoorSignal, shown?: Flash) {
    signalDoor(kind, soundOn);
    if (!shown) return;
    clearTimeout(flashTimer.current);
    setFlash(shown);
    flashTimer.current = setTimeout(() => setFlash(null), DOOR_FLASH_MS[kind]);
  }

  function closeFlash() {
    // A tap on the result also wakes the sound an iPhone stopped
    primeDoorSound();
    clearTimeout(flashTimer.current);
    setFlash(null);
  }

  function toggleSound() {
    primeDoorSound();
    const next = !soundOn;
    setSoundOn(next);
    setDoorSoundOn(next);
  }

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

  const refresh = useCallback(async (): Promise<Entry[]> => {
    if (!sessionId) return [];
    try {
      const activity = await ticketsApi.doorActivity(sessionId);
      const rows = activity.items
        .slice(0, RECENT)
        .map((item) => ({ id: item.id, name: item.personName, createdAt: item.createdAt }));
      setTotal(activity.total);
      setActivityError(null);
      setRecent(rows);
      return rows;
    } catch (err) {
      setActivityError(coreProblemMessage(err, 'Son girişler yüklenemedi'));
      return [];
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
      signal('in');
    } catch (err) {
      const refused = refusal(err, 'Giriş yazılamadı');
      setOutcome(refused);
      signal(refused.kind === 'already' ? 'already' : 'refused');
    } finally {
      setBusy(false);
      document.getElementById('door-query')?.focus();
    }
  }

  async function scanned(token: string) {
    // One code at a time; the scanner itself does not read the same code again for a while
    if (!sessionId || scanBusy.current) return;
    scanBusy.current = true;
    try {
      const created = await ticketsApi.scanCheckIn(sessionId, token);
      // The scan answers with the entry, not the name: core's list of entries names the holder
      admitted({
        id: created.id,
        name: created.personName || SCANNED,
        createdAt: created.createdAt,
      });
      signal('in', {
        signal: 'in',
        title: 'Giriş yazıldı',
        line: created.personName || '',
        time: timeOf(created.createdAt),
        entryId: created.id,
      });
      const rows = await refresh();
      const found = rows.find((row) => row.id === created.id);
      if (found?.name) {
        setOutcome((shown) =>
          shown?.kind === 'in' && shown.entry.id === created.id
            ? { kind: 'in', entry: { ...shown.entry, name: found.name } }
            : shown,
        );
        setFlash((shown) =>
          shown?.entryId === created.id ? { ...shown, line: found.name } : shown,
        );
      }
    } catch (err) {
      const refused = scanRefusal(err);
      setOutcome(refused);
      signal(refused.kind, { signal: refused.kind, title: refused.title, line: refused.text });
    } finally {
      scanBusy.current = false;
    }
  }

  /**
   * Takes an entry back after a few seconds with Vazgeç on a toast and in place: the desk
   * cannot write the same entry again from the list, so the wait is the way back.
   */
  function undo(entry: Entry) {
    const session = sessionId;
    if (!session) return;
    deferred.schedule(entry.id, `${entry.name}: giriş geri alınıyor`, async () => {
      try {
        await ticketsApi.undoCheckIn(session, entry.id);
        if (shownSession.current !== session) return;
        setOutcome({ kind: 'undone', name: entry.name });
        setRecent((rows) => rows.filter((row) => row.id !== entry.id));
        setTotal((count) => Math.max(0, count - 1));
        void refresh();
      } catch (err) {
        if (shownSession.current === session) {
          setOutcome({ kind: 'refused', text: coreProblemMessage(err, 'Geri alınamadı') });
        }
        // The hook says it on a toast when the desk is already gone
        throw err;
      }
    });
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
        <div className="space-y-1">
          <label htmlFor="door-query" className="block">
            <FieldLabel>Kişi ya da bilet</FieldLabel>
          </label>
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
        </div>
        {camera ? (
          <div className="flex gap-2">
            {!cameraOpen ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className={cn(BUTTON_TEXT, 'min-w-0 flex-1')}
                disabled={!sessionId}
                onClick={() => {
                  // The tap that opens the camera also lets the page beep (iPhone)
                  primeDoorSound();
                  setCameraOpen(true);
                }}
              >
                <ScanLine aria-hidden />
                Kamerayla tara
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="lg"
              className={cn(BUTTON_TEXT, cameraOpen && 'ml-auto')}
              aria-pressed={soundOn}
              onClick={toggleSound}
            >
              {soundOn ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
              Ses
            </Button>
          </div>
        ) : null}
      </form>
      {cameraOpen && sessionId ? (
        <DoorScanner onScan={(value) => void scanned(value)} onClose={() => setCameraOpen(false)} />
      ) : null}

      <DoorFlash result={flash} onClose={closeFlash} />

      <OutcomeBand
        outcome={outcome}
        waiting={deferred.pending}
        onUndo={undo}
        onKeep={(entry) => deferred.cancel(entry.id)}
      />

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
            {recent.map((row) => {
              const leaving = deferred.pending.has(row.id);
              return (
                <li
                  key={row.id}
                  className={cn(
                    'flex min-h-12 items-center gap-3 px-3 py-2',
                    leaving && 'opacity-60',
                  )}
                >
                  <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="text-foreground block truncate text-sm">{row.name}</span>
                    <span className={cn('text-subtle-foreground block', TEXT_SECONDARY)}>
                      {leaving ? 'Geri alınıyor…' : formatApplicantWhen(row.createdAt)}
                    </span>
                  </span>
                  {leaving ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={BUTTON_TEXT}
                      aria-label={`${row.name}: geri almaktan vazgeç`}
                      onClick={() => deferred.cancel(row.id)}
                    >
                      Vazgeç
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={BUTTON_TEXT}
                      aria-label={`${row.name}: girişi geri al`}
                      onClick={() => undo(row)}
                    >
                      <Undo2 aria-hidden />
                      Geri al
                    </Button>
                  )}
                </li>
              );
            })}
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
