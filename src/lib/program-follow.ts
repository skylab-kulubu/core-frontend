/**
 * "Programı izle" on the attendance QR screen: which session the screen shows by the clock, so one
 * OBS scene can stay up all day. Off by default (times slip on the day); the operator turns it on
 * per device.
 */

export type ProgramSession = {
  id: string;
  title: string;
  startTime?: string;
  endTime?: string;
  cancelled?: boolean;
};

/**
 * `current`: running now. `next`: none is, this one starts within HANDOVER_MS (or the day has not
 * begun). `last`: the session that ended last, kept for late scans until HANDOVER_MS before the
 * next one starts, and once the day is over.
 */
export type ProgramPickState = 'current' | 'next' | 'last';

export type ProgramPick<S extends ProgramSession> = { session: S; state: ProgramPickState };

/** A session without an end runs until the next one starts, the last one an hour. */
const OPEN_ENDED_MS = 60 * 60 * 1000;
/**
 * In a gap between sessions the one that ended stays on screen for late scans until this long
 * before the next one starts (Açılış ends 12:00, 1. Oturum starts 12:15: Açılış until 12:10).
 */
export const HANDOVER_MS = 5 * 60 * 1000;

/**
 * The session to show at `now`: the one running (the latest started, if they overlap); else, in a
 * gap, the one that ended last until HANDOVER_MS before the next one starts, then the next one;
 * before the first session the first; after the last the last. Cancelled sessions and sessions
 * without a start time are skipped; null when none is left.
 */
export function pickProgramSession<S extends ProgramSession>(
  sessions: readonly S[],
  now: number,
): ProgramPick<S> | null {
  const timed = sessions
    .filter((s) => !s.cancelled && Number.isFinite(Date.parse(s.startTime ?? '')))
    .map((s) => ({ s, start: Date.parse(s.startTime as string) }))
    .sort((a, b) => a.start - b.start);
  if (timed.length === 0) return null;

  const spans = timed.map(({ s, start }, i) => {
    const end = Date.parse(s.endTime ?? '');
    const next = timed.slice(i + 1).find((t) => t.start > start)?.start;
    return {
      s,
      start,
      end: Number.isFinite(end) && end > start ? end : (next ?? start + OPEN_ENDED_MS),
    };
  });

  let current: (typeof spans)[number] | undefined;
  for (const span of spans) {
    if (span.start <= now && now < span.end) current = span;
  }
  if (current) return { session: current.s, state: 'current' };
  let ended: (typeof spans)[number] | undefined;
  for (const span of spans) {
    if (span.end <= now && (!ended || span.end >= ended.end)) ended = span;
  }
  const next = spans.find((span) => span.start > now);
  if (next && (!ended || now >= next.start - HANDOVER_MS))
    return { session: next.s, state: 'next' };
  if (ended) return { session: ended.s, state: 'last' };
  return { session: spans[spans.length - 1].s, state: 'last' };
}

const CLOCK = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  hour: '2-digit',
  minute: '2-digit',
});

/** What the screen's title line says: the session, or "Sıradaki: 1. Oturum · 12:15". */
export function programTitle(pick: ProgramPick<ProgramSession>): string {
  if (pick.state !== 'next') return pick.session.title;
  const start = Date.parse(pick.session.startTime ?? '');
  return Number.isFinite(start)
    ? `Sıradaki: ${pick.session.title} · ${CLOCK.format(new Date(start))}`
    : `Sıradaki: ${pick.session.title}`;
}

const FOLLOW_KEY = 'attendance-qr-follow';

/** Whether this device's attendance QR screen follows the program (off unless turned on). */
export function followProgramOn(): boolean {
  try {
    return window.localStorage.getItem(FOLLOW_KEY) === 'on';
  } catch {
    return false;
  }
}

export function setFollowProgramOn(on: boolean): void {
  try {
    window.localStorage.setItem(FOLLOW_KEY, on ? 'on' : 'off');
  } catch {
    // private window: the choice lasts until the page is left
  }
}
