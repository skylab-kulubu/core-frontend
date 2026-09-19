import { checkInSuccessLine, resolveDoorTicket } from '@/lib/door-check-in';
import type { Ticket } from '@/lib/api/tickets';
import type { Person } from '@/lib/api/identity';

const member: Ticket = {
  id: 't-member',
  eventId: 'e1',
  ticketType: 'REGISTERED',
  ownerId: 'u1',
  checkIns: [],
  createdAt: '2026-09-19T08:05:00.000Z',
  updatedAt: '2026-09-19T08:05:00.000Z',
};

const guest: Ticket = {
  id: 't-guest',
  eventId: 'e1',
  ticketType: 'GUEST',
  guestFirstName: 'Ada',
  guestLastName: 'Lovelace',
  guestEmail: 'ada@example.com',
  checkIns: [],
  createdAt: '2026-09-19T08:05:00.000Z',
  updatedAt: '2026-09-19T08:05:00.000Z',
};

const people = new Map<string, Person>([
  ['u1', { id: 'u1', email: 'grace@skylab.com', firstName: 'Grace', lastName: 'Hopper' }],
]);

describe('resolveDoorTicket', () => {
  it('resolves a member by PersonPick id, not a pasted UUID as the primary key', () => {
    expect(resolveDoorTicket({ tickets: [member, guest], people, personId: 'u1' })?.id).toBe(
      't-member',
    );
  });

  it('resolves a guest by email', () => {
    expect(
      resolveDoorTicket({ tickets: [member, guest], people, email: 'ada@example.com' })?.id,
    ).toBe('t-guest');
  });

  it('resolves a guest by typed name', () => {
    expect(resolveDoorTicket({ tickets: [member, guest], people, email: 'Ada Lovelace' })?.id).toBe(
      't-guest',
    );
  });
});

describe('checkInSuccessLine', () => {
  it('shows name, session, and time instead of a check-in UUID', () => {
    expect(
      checkInSuccessLine({
        name: 'Grace Hopper',
        sessionTitle: 'Açılış',
        createdAt: new Date(2026, 8, 19, 9, 4, 0).toISOString(),
        now: new Date(2026, 8, 19, 10, 0, 0),
      }),
    ).toBe('Grace Hopper · Açılış · Bugün, 09:04');
  });
});
