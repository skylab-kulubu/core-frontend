import { personLabel } from '@/components/identity/PersonPick';
import type { Person } from '@/lib/api/identity';
import type { Ticket } from '@/lib/api/tickets';
import { canWriteEvent } from '@/lib/auth/groups';

export function canListEventTickets(groups: readonly string[], ownerTeam: string): boolean {
  return canWriteEvent(groups, ownerTeam, 'update');
}

export function ticketApplicantLabel(row: Ticket, people: Map<string, Person>): string {
  if (row.ticketType === 'GUEST') {
    const name = [row.guestFirstName, row.guestLastName].filter(Boolean).join(' ');
    if (name && row.guestEmail) return `${name} · ${row.guestEmail}`;
    return name || row.guestEmail || row.id;
  }
  const owner = row.ownerId ? people.get(row.ownerId) : undefined;
  return owner ? personLabel(owner) : row.ownerId || row.id;
}
