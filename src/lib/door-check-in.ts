import { personLabel } from '@/components/identity/PersonPick';
import { ProblemError } from '@/lib/api/core';
import type { Person } from '@/lib/api/identity';
import type { EventSession } from '@/lib/api/sessions';
import type { Ticket } from '@/lib/api/tickets';
import { coreProblemMessage } from '@/lib/core-problems';
import { DOOR_GUEST_QR_WINDOW_HOURS } from '@/lib/door-qr';
import { ticketApplicantName, formatApplicantWhen } from '@/lib/tickets-ui';

/** What the door needs to know about a session to pick and show it. */
export type DoorSession = Pick<
  EventSession,
  'id' | 'title' | 'startTime' | 'endTime' | 'cancelled'
>;

// Sessions happen in Istanbul: "today" and clock times must not follow the door device's time zone.
const DOOR_TIME = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function istanbulParts(ms: number): { day: string; date: string; time: string } {
  const parts = DOOR_TIME.formatToParts(new Date(ms));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return {
    day: `${part('year')}-${part('month')}-${part('day')}`,
    date: `${part('day')} ${part('month')}`,
    time: `${part('hour')}:${part('minute')}`,
  };
}

function sessionMs(iso?: string): number {
  return iso ? new Date(iso).getTime() : Number.NaN;
}

/** The one candidate, or none when two or more tie (parallel sessions need a human choice). */
function onlyOne(candidates: readonly DoorSession[]): string {
  return candidates.length === 1 ? candidates[0].id : '';
}

/**
 * The session a check-in goes to before anyone picks one: the only open session, the one running
 * now, or the next one starting later today (Istanbul time). Cancelled sessions never count.
 * Empty when none of these holds or when two sessions run or start together: the operator must
 * choose, so check-ins never land in a session by accident.
 */
export function defaultDoorSessionId(sessions: readonly DoorSession[], now = new Date()): string {
  const open = sessions.filter((session) => !session.cancelled);
  if (open.length <= 1) return onlyOne(open);
  const at = now.getTime();
  const running = open.filter(
    (session) => sessionMs(session.startTime) <= at && at < sessionMs(session.endTime),
  );
  if (running.length > 0) return onlyOne(running);
  const today = istanbulParts(at).day;
  const laterToday = open.filter((session) => {
    const start = sessionMs(session.startTime);
    return start > at && istanbulParts(start).day === today;
  });
  if (laterToday.length === 0) return '';
  const first = Math.min(...laterToday.map((session) => sessionMs(session.startTime)));
  return onlyOne(laterToday.filter((session) => sessionMs(session.startTime) === first));
}

/** Option text for a session picker: title plus day and start time, so same-named sessions differ. */
export function doorSessionLabel(session: DoorSession): string {
  const start = sessionMs(session.startTime);
  let label = session.title;
  if (!Number.isNaN(start)) {
    const { date, time } = istanbulParts(start);
    label += ` · ${date} ${time}`;
  }
  return session.cancelled ? `${label} · iptal` : label;
}

/**
 * A short, non-blocking note when the chosen session is not running now: cancelled, not started
 * yet, or already over. Null while it runs or when its times are unknown.
 */
export function doorSessionTiming(
  session: DoorSession | undefined,
  now = new Date(),
): string | null {
  if (!session) return null;
  if (session.cancelled) return 'Bu oturum iptal edildi.';
  const at = now.getTime();
  const start = sessionMs(session.startTime);
  const end = sessionMs(session.endTime);
  const clock = (ms: number) => {
    const parts = istanbulParts(ms);
    return parts.day === istanbulParts(at).day ? parts.time : `${parts.date} ${parts.time}`;
  };
  // The guest QR's window (core's session grace); staff check-ins are never time-limited.
  const windowMs = DOOR_GUEST_QR_WINDOW_HOURS * 3600_000;
  if (start > at) {
    const qr =
      start - windowMs <= at
        ? 'misafir QR’ı şimdiden açık'
        : `misafir QR’ı başlangıçtan ${DOOR_GUEST_QR_WINDOW_HOURS} saat önce açılır`;
    return `Bu oturum henüz başlamadı (başlangıç ${clock(start)}); ${qr}.`;
  }
  if (end <= at) {
    const qr =
      at <= end + windowMs
        ? `misafir QR’ı bitişten ${DOOR_GUEST_QR_WINDOW_HOURS} saat sonrasına kadar açık`
        : 'misafir QR’ı kapandı';
    return `Bu oturum bitti (bitiş ${clock(end)}); ${qr}.`;
  }
  return null;
}

export function resolveDoorTicket(args: {
  tickets: readonly Ticket[];
  people: Map<string, Person>;
  personId?: string;
  email?: string;
}): Ticket | undefined {
  const personId = args.personId?.trim();
  if (personId) {
    return args.tickets.find((row) => row.ownerId === personId);
  }
  const query = args.email?.trim().toLowerCase();
  if (!query) return undefined;
  const matches = args.tickets.filter((row) => {
    if (row.guestEmail?.toLowerCase() === query) return true;
    if (row.owner?.email?.toLowerCase() === query) return true;
    const person = row.ownerId ? args.people.get(row.ownerId) : undefined;
    if (person?.email?.toLowerCase() === query) return true;
    const name = ticketApplicantName(row, args.people).trim().toLowerCase();
    return Boolean(name) && name === query;
  });
  return matches.length === 1 ? matches[0] : undefined;
}

export function checkInSuccessLine(args: {
  name: string;
  sessionTitle: string;
  createdAt: string;
  now?: Date;
}): string {
  return `${args.name} · ${args.sessionTitle} · ${formatApplicantWhen(args.createdAt, args.now)}`;
}

export function doorTicketName(
  ticket: Ticket,
  people: Map<string, Person>,
  picked?: Person | null,
): string {
  if (picked) return personLabel(picked);
  return ticketApplicantName(ticket, people);
}

/**
 * core's 409 on a check-in (no code, no detail): the person is already in that
 * session. For coreProblemMessage's `statusText`.
 */
export const ALREADY_CHECKED_IN = { 409: 'Bu kişi bu oturuma zaten girmiş.' };

/** A scan core did not write, in the door's words: a short title and one line under it. */
export type ScanRefusal = { kind: 'already' | 'refused'; title: string; text: string };

/**
 * core's 409s on the door's ways in (core handlers ticketError): a bare 409 is the one that
 * means "already in"; `ticket_cancelled` and `ticket_waitlisted` refuse a Ticket that is not
 * active (core docs/ticket-cancellation.md); `Ambiguous Match` (resolve by name) found two
 * people. Null for any other answer, and for a 409 whose code the door does not know (a refusal).
 */
export function doorConflict(error: unknown): ScanRefusal | null {
  if (!(error instanceof ProblemError) || error.status !== 409) return null;
  switch (error.code) {
    case 'ticket_cancelled':
      return { kind: 'refused', title: 'Bilet iptal edilmiş', text: 'Bu bilet kapıdan geçmez.' };
    case 'ticket_waitlisted':
      return {
        kind: 'refused',
        title: 'Bilet bekleme listesinde',
        text: 'Bu bilet henüz etkin değil.',
      };
    case undefined:
      break;
    default:
      return {
        kind: 'refused',
        title: 'Girmedi',
        text: coreProblemMessage(error, 'Giriş yazılamadı'),
      };
  }
  if (error.title === 'Ambiguous Match') {
    return { kind: 'refused', title: 'Birden fazla kişi', text: coreProblemMessage(error) };
  }
  return { kind: 'already', title: 'Zaten girmiş', text: ALREADY_CHECKED_IN[409] };
}

/**
 * What a refused scan says (core docs/ticket-qr.md): already in, a cancelled or waitlisted
 * ticket, another event's ticket, an expired, renewed or foreign code, a closed session. Never null: anything else is "Okunamadı"
 * with core's reason.
 */
export function scanRefusal(error: unknown): ScanRefusal {
  const status = error instanceof ProblemError ? error.status : 0;
  const code = error instanceof ProblemError ? error.code : undefined;
  const conflict = doorConflict(error);
  if (conflict?.kind === 'already') {
    return { ...conflict, text: 'Bu bilet bu oturumda daha önce okundu.' };
  }
  if (conflict) return conflict;
  if (status === 404) {
    return {
      kind: 'refused',
      title: 'Bu etkinliğin bileti değil',
      text: 'Başka bir etkinliğin bileti ya da bilet yok.',
    };
  }
  if (code === 'ticket_qr_expired') {
    return { kind: 'refused', title: 'Biletin süresi dolmuş', text: 'Etkinlik bitmiş.' };
  }
  if (code === 'ticket_qr_superseded') {
    return { kind: 'refused', title: 'Bilet yenilenmiş', text: 'Kişi son postadaki bileti açsın.' };
  }
  if (status === 401) {
    return { kind: 'refused', title: 'Geçersiz bilet', text: 'Bu kod bir SKY LAB bileti değil.' };
  }
  if (code === 'session_closed') {
    return { kind: 'refused', title: 'Oturum girişe kapalı', text: 'Etkinlik taslak ya da iptal.' };
  }
  if (status === 403) {
    return { kind: 'refused', title: 'Yetkin yok', text: 'Bu kapıda giriş yazamazsın.' };
  }
  return { kind: 'refused', title: 'Okunamadı', text: coreProblemMessage(error, 'Kod okunamadı') };
}
