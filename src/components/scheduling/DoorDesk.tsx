'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button, buttonVariants, cn, TaskPage } from '@skylab-kulubu/skylcn-ui';
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  DoorOpen,
  Inbox,
  Presentation,
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
import { useConfirm } from '@/lib/ui/use-confirm';
import { useDeferredUndo } from '@/lib/ui/use-deferred-undo';

type Entry = { id: string; name: string; createdAt: string };

/** What the last attempt came to, in one large band (pretixSCAN): in, already in, or not. */
type Outcome =
  | { kind: 'in'; entry: Entry }
  | { kind: 'undone'; name: string }
  | { kind: 'already'; text: string; title?: string }
  | { kind: 'refused'; text: string; title?: string };

/** An attempt core did not write. */
type Refused = Extract<Outcome, { kind: 'already' | 'refused' }>;

/** The full-screen result of a scan, tied to its entry so the name can arrive after it. */
type Flash = DoorFlashResult & { entryId?: string };

const RECENT = 10;
/**
 * The picker's value for the event's own door, "Alana giriş" (core docs/venue-entry.md): no
 * session, the scan writes the day's venue entry. The only door of an event without sessions.
 */
export const EVENT_DOOR = 'event';
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
 * A refusal at a session's attendance on an event run with one entry a day (Oturum katılımı):
 * already there is "already attended"; a core that writes the day's venue entry alone at a
 * session answers a person let in today with `already_entered`, and nothing was written for the
 * session (the desk by name writes it).
 */
function asAttendance(refused: Refused, err: unknown): Refused & { title: string } {
  if (err instanceof ProblemError && err.code === 'already_entered') {
    return { kind: 'refused', title: NOT_ATTENDED, text: ENTERED_ATTEND_BY_NAME };
  }
  if (refused.kind === 'already') return { ...refused, title: 'Zaten katılmış' };
  return { ...refused, title: refused.title ?? 'Katılmadı' };
}

const NOT_ATTENDED = 'Katılım yazılmadı';
const ATTEND_BY_NAME = 'Yalnız alana giriş yazıldı; katılımı adıyla yaz.';
const ENTERED_ATTEND_BY_NAME = 'Kişi bugün alana girmiş; katılımı adıyla yaz.';

/**
 * A refusal in the door's words: already in (amber), a cancelled or waitlisted ticket, two
 * people of that name, nobody found, or core's Turkish reason (red).
 */
function refusal(err: unknown, fallback: string): Refused {
  const conflict = doorConflict(err);
  if (conflict?.kind === 'already') {
    return { kind: 'already', title: conflict.title, text: conflict.text };
  }
  if (conflict) return { kind: 'refused', title: conflict.title, text: conflict.text };
  if (err instanceof ProblemError && err.status === 404) {
    return { kind: 'refused', text: 'Bulunamadı. Adı, e-postayı ya da bilet kodunu denetle.' };
  }
  return { kind: 'refused', text: coreProblemMessage(err, fallback, ALREADY_CHECKED_IN) };
}

function OutcomeBand({
  outcome,
  attendance,
  waiting,
  onUndo,
  onKeep,
}: {
  outcome: Outcome | null;
  /** The session's attendance (Oturum katılımı), not an entry. */
  attendance: boolean;
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
                ? attendance
                  ? 'Katıldı'
                  : 'Girdi'
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

/** One of the door's two tabs on an event run with one entry a day. */
function ModeTab({
  selected,
  Icon,
  label,
  onSelect,
}: {
  selected: boolean;
  Icon: typeof DoorOpen;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        'focus-visible:ring-ring flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium outline-hidden focus-visible:ring-2',
        selected
          ? 'bg-card text-foreground-strong shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </button>
  );
}

/** A live count: what it counts on top, the number large, its unit beside it. */
function DoorCount({
  label,
  title,
  value,
  unit,
  current = false,
}: {
  label: string;
  title: string;
  value: number | null;
  unit: string;
  /** The count of what the door writes now, beside another. */
  current?: boolean;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        'bg-card min-w-0 rounded-xl border p-4',
        current ? 'border-primary/60' : 'border-border-subtle',
      )}
    >
      <p className={cn('text-muted-foreground break-words', TEXT_SECONDARY)}>{title}</p>
      <div className="flex items-end justify-between gap-3">
        <p className="text-foreground-strong text-4xl leading-none font-semibold tabular-nums">
          {value ?? '—'}
        </p>
        <p className={cn('text-muted-foreground', TEXT_SECONDARY)}>{unit}</p>
      </div>
    </div>
  );
}

/**
 * The door of one event, a focus page without the sidebar: the session and its count on top,
 * one box for a name, an e-mail or a ticket code (or the camera), a large result band that can
 * take the entry back, the guest QR and the last entries.
 *
 * An event run with one entry a day and sessions keeps the two apart, as check-in apps keep the
 * venue's check-in and a session's (Cvent OnArrival's event and session check-in, pretix's
 * check-in lists): two tabs, "Alana giriş" (the default: the day's venue entry) and "Oturum
 * katılımı" (the chosen session's attendance, asked before the session is taken), each with its
 * own count and list.
 */
export function DoorDesk({ eventId }: { eventId: string }) {
  const [events, setEvents] = useState<DoorEvent[]>([]);
  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [recent, setRecent] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  // The day's venue entries beside a session's attendance (Oturum katılımı)
  const [venueTotal, setVenueTotal] = useState<number | null>(null);
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
  const [confirm, confirmDialog] = useConfirm();
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
          const door = rows.find((row) => row.id === eventId);
          // No live session, or the event runs with one entry a day: the event's door first
          const live = flat.filter((session) => !session.cancelled);
          setSessionId(
            live.length === 0 || door?.effectiveEntryMode === 'venue'
              ? EVENT_DOOR
              : defaultDoorSessionId(flat),
          );
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

  const atEventDoor = sessionId === EVENT_DOOR;
  const hasSessions = sessions.some((session) => !session.cancelled);
  // The venue entry and a session's attendance apart: an event run with one entry a day that has
  // sessions. Its door is the venue's (Alana giriş) unless the staff turn to a session.
  const split = hasSessions && event?.effectiveEntryMode === 'venue';
  const attendance = split && !atEventDoor;

  const refresh = useCallback(async (): Promise<Entry[]> => {
    if (!sessionId) return [];
    try {
      if (sessionId === EVENT_DOOR) {
        const entries = await ticketsApi.venueEntries(eventId);
        const rows = entries
          .slice(0, RECENT)
          .map((item) => ({ id: item.id, name: item.name, createdAt: item.createdAt }));
        setTotal(entries.length);
        setActivityError(null);
        setRecent(rows);
        return rows;
      }
      // The session's attendance alone; at an event run with one entry a day the day's entries
      // beside it, on a count of their own
      const [activity, entries] = await Promise.all([
        ticketsApi.doorActivity(sessionId),
        split ? ticketsApi.venueEntries(eventId).catch(() => null) : null,
      ]);
      const rows = activity.items
        .slice(0, RECENT)
        .map((item) => ({ id: item.id, name: item.personName, createdAt: item.createdAt }));
      setTotal(activity.total);
      setVenueTotal(entries ? entries.length : null);
      setActivityError(null);
      setRecent(rows);
      return rows;
    } catch (err) {
      setActivityError(coreProblemMessage(err, 'Son girişler yüklenemedi'));
      return [];
    }
  }, [sessionId, eventId, split]);

  useEffect(() => {
    setRecent([]);
    setTotal(0);
    setVenueTotal(null);
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
      const created =
        sessionId === EVENT_DOOR
          ? await ticketsApi.resolveEntry(eventId, target)
          : await ticketsApi.resolveAndCheckIn(sessionId, target);
      const name = 'personName' in created ? created.personName : created.name;
      admitted({ id: created.id, name: name || label, createdAt: created.createdAt });
      signal('in');
    } catch (err) {
      const said = refusal(err, attendance ? 'Katılım yazılamadı' : 'Giriş yazılamadı');
      const refused = attendance ? asAttendance(said, err) : said;
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
      const written =
        sessionId === EVENT_DOOR
          ? await ticketsApi.scanEntry(eventId, token)
          : attendance
            ? await ticketsApi.scanCheckIn(sessionId, token, { checkIn: true })
            : await ticketsApi.scanCheckIn(sessionId, token);
      if (attendance && 'kind' in written && written.kind === 'entry') {
        // A core that writes the venue entry alone at a session: nothing for the session
        const refused = { kind: 'refused' as const, title: NOT_ATTENDED, text: ATTEND_BY_NAME };
        setOutcome(refused);
        signal('refused', { signal: 'refused', title: refused.title, line: refused.text });
        return;
      }
      const created = {
        id: written.id,
        createdAt: written.createdAt,
        personName: 'name' in written ? written.name : written.personName,
      };
      // The scan answers with the entry, not the name: core's list of entries names the holder
      admitted({
        id: created.id,
        name: created.personName || SCANNED,
        createdAt: created.createdAt,
      });
      signal('in', {
        signal: 'in',
        title: attendance ? 'Katılım yazıldı' : 'Giriş yazıldı',
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
      const refused = attendance ? asAttendance(scanRefusal(err), err) : scanRefusal(err);
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
    const what = attendance ? 'katılım' : 'giriş';
    deferred.schedule(entry.id, `${entry.name}: ${what} geri alınıyor`, async () => {
      try {
        if (session === EVENT_DOOR) await ticketsApi.undoEntry(eventId, entry.id);
        else await ticketsApi.undoCheckIn(session, entry.id);
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
  // The event's own door: on an event without sessions, or one run with one entry a day; an
  // event run per session keeps its sessions' doors alone
  const offerEventDoor = !hasSessions || event?.effectiveEntryMode === 'venue';
  // Never blocks: what the door writes here, why nothing is chosen, or that the chosen session
  // is not running now
  const sessionNote = atEventDoor
    ? hasSessions
      ? 'Okutulan bilet bugünkü alana girişi yazar; oturum katılımı yazılmaz.'
      : 'Bu etkinliğin oturumu yok: kapı alana girişi yazar.'
    : attendance
      ? !sessionId
        ? 'Oturumu seç: okutulan ya da yazılan herkes o oturuma katılmış sayılır.'
        : (doorSessionTiming(selectedSession) ??
          'Okutulan ya da yazılan herkes bu oturuma katılmış sayılır.')
      : !sessionId && sessions.length > 0
        ? 'Şu an süren oturum yok; giriş oturumunu seç.'
        : doorSessionTiming(selectedSession);

  /**
   * Turns the door to a session: on an event run with one entry a day only after a question
   * that names it, since everyone written there counts as attending it.
   */
  function pickSession(next: string) {
    const chosen = sessions.find((session) => session.id === next);
    if (!split || !chosen) {
      setSessionId(next);
      return;
    }
    confirm({
      title: `"${chosen.title}" oturumuna katılım yazılsın mı?`,
      description:
        'Kapıda alana giriş okutulur. Burada okutulan ya da yazılan herkes bu oturuma katılmış sayılır.',
      actionLabel: 'Oturumu seç',
      destructive: false,
      onConfirm: () => setSessionId(next),
    });
  }
  const writeLabel = attendance ? 'Katılımı yaz' : 'Girişi yaz';

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

      {split ? (
        <div
          role="tablist"
          aria-label="Kapıda yazılan"
          className="border-border-subtle bg-muted grid grid-cols-2 gap-1 rounded-xl border p-1"
        >
          <ModeTab
            selected={atEventDoor}
            Icon={DoorOpen}
            label="Alana giriş"
            onSelect={() => setSessionId(EVENT_DOOR)}
          />
          <ModeTab
            selected={!atEventDoor}
            Icon={Presentation}
            label="Oturum katılımı"
            onSelect={() => {
              if (atEventDoor) setSessionId('');
            }}
          />
        </div>
      ) : null}

      {split && atEventDoor ? null : (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="block space-y-1">
            <FieldLabel>Oturum</FieldLabel>
            <Select
              value={sessionId}
              onChange={(change) => pickSession(change.target.value)}
              aria-describedby={sessionNote ? 'door-session-note' : undefined}
              className="h-11"
            >
              {hasSessions ? <option value="">Oturum seç</option> : null}
              {offerEventDoor && !split ? <option value={EVENT_DOOR}>Alana giriş</option> : null}
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {doorSessionLabel(session)}
                </option>
              ))}
            </Select>
          </label>
          {hasSessions ? (
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
          ) : null}
        </div>
      )}
      {sessionNote ? (
        <p id="door-session-note" className={cn('text-muted-foreground', TEXT_SECONDARY)}>
          {sessionNote}
        </p>
      ) : null}

      <div className={cn('grid gap-3', attendance && sessionId && 'grid-cols-2')}>
        <DoorCount
          label={attendance ? 'Katılan sayısı' : 'Giren sayısı'}
          title={
            atEventDoor
              ? 'Alana giriş · bugün'
              : attendance
                ? 'Oturum katılımı'
                : selectedSession
                  ? selectedSession.title
                  : 'Oturum seçilmedi'
          }
          value={sessionId ? total : null}
          unit={attendance ? 'katılan' : 'giren'}
          current={attendance}
        />
        {attendance && sessionId ? (
          <DoorCount
            label="Alana giren sayısı"
            title="Alana giriş · bugün"
            value={venueTotal}
            unit="giren"
          />
        ) : null}
      </div>

      {guestQr && sessionId && !atEventDoor ? <GuestDoorQr sessionId={sessionId} open /> : null}

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
              {busy ? 'Yazılıyor…' : writeLabel}
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
        attendance={attendance}
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
                  {writeLabel}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <section aria-label={attendance ? 'Son katılanlar' : 'Son girişler'} className="space-y-2">
        <h2 className="text-foreground text-sm font-semibold">
          {atEventDoor && split
            ? 'Son alana girişler'
            : attendance
              ? 'Bu oturuma son katılanlar'
              : 'Son girişler'}
        </h2>
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
            {atEventDoor
              ? 'Bugün henüz giriş yok'
              : attendance && sessionId
                ? 'Bu oturuma henüz katılan yok'
                : sessionId
                  ? 'Bu oturumda henüz giriş yok'
                  : 'Oturum seç'}
          </p>
        )}
      </section>
      {confirmDialog}
    </div>,
  );
}
