import { personLabel } from '@/components/identity/PersonPick';
import type { Person } from '@/lib/api/identity';
import type { EventSession } from '@/lib/api/sessions';
import type { Ticket } from '@/lib/api/tickets';
import { pad2 } from '@/lib/date-picker';
import { MONTHS_TR, ticketApplicantName, formatApplicantWhen } from '@/lib/tickets-ui';

/** What the door needs to know about a session to pick and show it. */
export type DoorSession = Pick<EventSession, 'id' | 'title' | 'startTime' | 'endTime'>;

function sessionMs(iso?: string): number {
  return iso ? new Date(iso).getTime() : Number.NaN;
}

/**
 * The session a check-in goes to before anyone picks one: the only session, the one running
 * now, or the next one starting later today. Empty when none of these holds (or two sessions
 * run at once): the operator must choose, so check-ins never land in a session by accident.
 */
export function defaultDoorSessionId(sessions: readonly DoorSession[], now = new Date()): string {
  if (sessions.length === 1) return sessions[0].id;
  const at = now.getTime();
  const running = sessions.filter(
    (session) => sessionMs(session.startTime) <= at && at < sessionMs(session.endTime),
  );
  if (running.length > 0) return running.length === 1 ? running[0].id : '';
  const sameDay = (ms: number) => new Date(ms).toDateString() === now.toDateString();
  const nextToday = sessions
    .filter((session) => {
      const start = sessionMs(session.startTime);
      return start > at && sameDay(start);
    })
    .sort((a, b) => sessionMs(a.startTime) - sessionMs(b.startTime));
  return nextToday[0]?.id ?? '';
}

/** Option text for a session picker: title plus day and start time, so same-named sessions differ. */
export function doorSessionLabel(session: DoorSession): string {
  const start = new Date(session.startTime ?? '');
  if (Number.isNaN(start.getTime())) return session.title;
  const day = `${pad2(start.getDate())} ${MONTHS_TR[start.getMonth()] ?? ''}`;
  return `${session.title} · ${day} ${pad2(start.getHours())}:${pad2(start.getMinutes())}`;
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
