import { asHitList, hitUserLabel, hitWhen } from '@/lib/api/urls';
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

  it('does not resolve a partial or ambiguous typed name', () => {
    const duplicate: Ticket = {
      ...guest,
      id: 't-guest-2',
      guestEmail: 'ada.duplicate@example.com',
    };
    expect(resolveDoorTicket({ tickets: [member, guest], people, email: 'Ada' })).toBeUndefined();
    expect(
      resolveDoorTicket({ tickets: [member, guest, duplicate], people, email: 'Ada Lovelace' }),
    ).toBeUndefined();
  });

  it('does not throw when a roster person is missing email', () => {
    const sparse = new Map<string, Person>([
      ['u1', { id: 'u1', firstName: 'Grace', lastName: 'Hopper' } as Person],
    ]);
    expect(
      resolveDoorTicket({ tickets: [member, guest], people: sparse, email: 'grace@skylab.com' }),
    ).toBeUndefined();
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

describe('hitWhen', () => {
  it('uses the canonical createdAt field', () => {
    expect(hitWhen({ createdAt: '2026-09-19T08:05:00.000Z' })).toBe('2026-09-19T08:05:00.000Z');
  });
});

describe('asHitList', () => {
  it('turns a null hits body into an empty list', () => {
    expect(asHitList(null)).toEqual([]);
    expect(asHitList(undefined)).toEqual([]);
  });
});

describe('hitUserLabel', () => {
  it('treats empty userId as a public click', () => {
    expect(hitUserLabel({ userId: '' })).toBe('—');
    expect(hitUserLabel({})).toBe('—');
  });

  it('shows the userId when the hop already carried one', () => {
    expect(hitUserLabel({ userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' })).toBe(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    );
  });
});
