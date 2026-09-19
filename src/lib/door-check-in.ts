import { personLabel } from '@/components/identity/PersonPick';
import type { Person } from '@/lib/api/identity';
import type { Ticket } from '@/lib/api/tickets';
import { ticketApplicantName, formatApplicantWhen } from '@/lib/tickets-ui';

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
  return args.tickets.find((row) => {
    if (row.guestEmail?.toLowerCase() === query) return true;
    if (row.owner?.email?.toLowerCase() === query) return true;
    const person = row.ownerId ? args.people.get(row.ownerId) : undefined;
    if (person?.email?.toLowerCase() === query) return true;
    const name = ticketApplicantName(row, args.people).trim().toLowerCase();
    return Boolean(name) && (name === query || name.includes(query));
  });
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
