import type { Person } from '@/lib/api/identity';
import type { Ticket } from '@/lib/api/tickets';
import {
  filterApplicantRoster,
  ticketDetailFields,
  ticketMailRecipients,
  ticketRosterRow,
} from '@/lib/tickets-ui';

const ada: Ticket = {
  id: 't-guest',
  eventId: 'e1',
  ticketType: 'GUEST',
  guestFirstName: 'Ada',
  guestLastName: 'Lovelace',
  guestEmail: 'ada@example.com',
  guestPhoneNumber: '555',
  checkIns: [],
  createdAt: new Date(2026, 8, 19, 8, 5, 0).toISOString(),
  updatedAt: new Date(2026, 8, 19, 8, 5, 0).toISOString(),
};

describe('ticket roster row', () => {
  it('shows guest name, email, Misafir type, apply form, and kayıtlı status', () => {
    const row = ticketRosterRow(
      ada,
      new Map(),
      {
        id: 'e1',
        formUrl: 'https://forms.yildizskylab.com/apply',
        formAlias: 'skydays2026',
      },
      new Date(2026, 8, 19, 10, 0, 0),
    );
    expect(row.name).toBe('Ada Lovelace');
    expect(row.email).toBe('ada@example.com');
    expect(row.ticketTypeLabel).toBe('Misafir');
    expect(row.sourceFormLabel).toBe('Başvuru formu');
    expect(row.sourceFormHref).toBe('https://skyl.app/skydays2026');
    expect(row.createdAtLabel).toBe('Bugün, 08:05');
    expect(row.statusLabel).toBe('Kayıtlı');
  });

  it('shows a member by account name and Üye type, not the public form', () => {
    const people = new Map<string, Person>([
      [
        'u1',
        {
          id: 'u1',
          email: 'grace@skylab.com',
          firstName: 'Grace',
          lastName: 'Hopper',
        },
      ],
    ]);
    const member: Ticket = {
      id: 't-member',
      eventId: 'e1',
      ticketType: 'REGISTERED',
      ownerId: 'u1',
      checkIns: [
        {
          id: 'c1',
          ticketId: 't-member',
          sessionId: 's1',
          eventDayId: 'd1',
          createdAt: new Date(2026, 8, 19, 9, 0, 0).toISOString(),
        },
      ],
      createdAt: new Date(2026, 0, 5, 14, 0, 0).toISOString(),
      updatedAt: new Date(2026, 0, 5, 14, 0, 0).toISOString(),
    };
    const row = ticketRosterRow(
      member,
      people,
      { id: 'e1', formUrl: 'https://forms.yildizskylab.com/apply' },
      new Date(2026, 8, 19, 10, 0, 0),
    );
    expect(row.name).toBe('Grace Hopper');
    expect(row.email).toBe('grace@skylab.com');
    expect(row.ticketTypeLabel).toBe('Üye');
    expect(row.sourceFormLabel).toBe('Üye kaydı');
    expect(row.sourceFormHref).toBeNull();
    expect(row.createdAtLabel).toBe('05 Oca');
    expect(row.statusLabel).toBe('Giriş yaptı');
  });
});

describe('filter applicant roster', () => {
  const people = new Map<string, Person>([
    ['u1', { id: 'u1', email: 'grace@skylab.com', firstName: 'Grace', lastName: 'Hopper' }],
  ]);
  const guest: Ticket = {
    id: 't-guest',
    eventId: 'e1',
    ticketType: 'GUEST',
    guestFirstName: 'Ada',
    guestLastName: 'Lovelace',
    guestEmail: 'ada@example.com',
    checkIns: [],
    createdAt: '2026-09-19T05:00:00.000Z',
    updatedAt: '2026-09-19T05:00:00.000Z',
  };
  const member: Ticket = {
    id: 't-member',
    eventId: 'e1',
    ticketType: 'REGISTERED',
    ownerId: 'u1',
    checkIns: [
      {
        id: 'c1',
        ticketId: 't-member',
        sessionId: 's1',
        eventDayId: 'd1',
        createdAt: '2026-09-19T06:00:00.000Z',
      },
    ],
    createdAt: '2026-01-05T11:00:00.000Z',
    updatedAt: '2026-01-05T11:00:00.000Z',
  };

  it('keeps guests matching email search and drops members', () => {
    expect(
      filterApplicantRoster([guest, member], people, {
        query: 'ada@',
        ticketType: 'all',
        status: 'all',
      }).map((row) => row.id),
    ).toEqual(['t-guest']);
  });

  it('filters to Üye tickets that already checked in', () => {
    expect(
      filterApplicantRoster([guest, member], people, {
        query: '',
        ticketType: 'REGISTERED',
        status: 'checked-in',
      }).map((row) => row.id),
    ).toEqual(['t-member']);
  });
});

describe('ticket detail fields', () => {
  it('labels every guest field instead of dumping raw keys', () => {
    const ticket: Ticket = {
      id: 't-guest',
      eventId: 'e1',
      ticketType: 'GUEST',
      guestFirstName: 'Ada',
      guestLastName: 'Lovelace',
      guestEmail: 'ada@example.com',
      guestPhoneNumber: '555',
      guestUniversity: 'YTÜ',
      guestFaculty: 'Elektrik',
      guestDepartment: 'Bilgisayar',
      guestGrade: '3',
      sent: false,
      checkIns: [],
      createdAt: new Date(2026, 8, 19, 8, 5, 0).toISOString(),
      updatedAt: new Date(2026, 8, 19, 8, 5, 0).toISOString(),
      note: 'VIP',
    } as Ticket;
    const fields = ticketDetailFields(
      ticket,
      new Map(),
      { id: 'e1', name: 'SkyDays', formAlias: 'skydays2026' },
      { now: new Date(2026, 8, 19, 10, 0, 0) },
    );
    const byLabel = Object.fromEntries(fields.map((field) => [field.label, field]));
    expect(byLabel['Ad']?.value).toBe('Ada Lovelace');
    expect(byLabel['E-posta']?.value).toBe('ada@example.com');
    expect(byLabel['Telefon']?.value).toBe('555');
    expect(byLabel['Bilet türü']?.value).toBe('Misafir');
    expect(byLabel['Kaynak form']?.value).toBe('Başvuru formu');
    expect(byLabel['Kaynak form']?.href).toBe('https://skyl.app/skydays2026');
    expect(byLabel['Durum']?.value).toBe('Kayıtlı');
    expect(byLabel['Üniversite']?.value).toBe('YTÜ');
    expect(byLabel['Fakülte']?.value).toBe('Elektrik');
    expect(byLabel['Bölüm']?.value).toBe('Bilgisayar');
    expect(byLabel['Sınıf']?.value).toBe('3');
    expect(byLabel['Mail']?.value).toBe('Hayır');
    expect(byLabel['Oluşturulma']?.value).toBe('Bugün, 08:05');
    expect(byLabel['Bilet']?.value).toBe('t-guest');
    expect(byLabel['Etkinlik']?.value).toBe('SkyDays');
    expect(byLabel['Check-in']?.value).toBe('—');
    expect(byLabel['Note']?.value).toBe('VIP');
    expect(fields.some((field) => field.label === 'guestFirstName')).toBe(false);
  });

  it('names a member check-in by session title and links the user', () => {
    const people = new Map<string, Person>([
      ['u1', { id: 'u1', email: 'grace@skylab.com', firstName: 'Grace', lastName: 'Hopper' }],
    ]);
    const ticket: Ticket = {
      id: 't-member',
      eventId: 'e1',
      ticketType: 'REGISTERED',
      ownerId: 'u1',
      checkIns: [
        {
          id: 'c1',
          ticketId: 't-member',
          sessionId: 's1',
          eventDayId: 'd1',
          createdAt: new Date(2026, 8, 19, 9, 0, 0).toISOString(),
        },
      ],
      createdAt: new Date(2026, 8, 19, 8, 0, 0).toISOString(),
      updatedAt: new Date(2026, 8, 19, 9, 0, 0).toISOString(),
    };
    const fields = ticketDetailFields(
      ticket,
      people,
      { id: 'e1', name: 'SkyDays' },
      {
        sessions: [{ id: 's1', title: 'Açılış' }],
        now: new Date(2026, 8, 19, 10, 0, 0),
      },
    );
    const byLabel = Object.fromEntries(fields.map((field) => [field.label, field]));
    expect(byLabel['Ad']?.value).toBe('Grace Hopper');
    expect(byLabel['Üye']?.href).toBe('/users/u1');
    expect(byLabel['Kaynak form']?.value).toBe('Üye kaydı');
    expect(byLabel['Check-in']?.value).toBe('Açılış · Bugün, 09:00');
  });
});

describe('ticket mail recipients', () => {
  it('uses guest email and member account email as the mail seam', () => {
    const people = new Map<string, Person>([
      ['u1', { id: 'u1', email: 'grace@skylab.com', firstName: 'Grace', lastName: 'Hopper' }],
    ]);
    const guest: Ticket = {
      id: 't-guest',
      eventId: 'e1',
      ticketType: 'GUEST',
      guestFirstName: 'Ada',
      guestLastName: 'Lovelace',
      guestEmail: 'ada@example.com',
      checkIns: [],
      createdAt: '',
      updatedAt: '',
    };
    const member: Ticket = {
      id: 't-member',
      eventId: 'e1',
      ticketType: 'REGISTERED',
      ownerId: 'u1',
      checkIns: [],
      createdAt: '',
      updatedAt: '',
    };
    expect(ticketMailRecipients([guest, member], people)).toEqual([
      { ticketId: 't-guest', name: 'Ada Lovelace', email: 'ada@example.com' },
      { ticketId: 't-member', name: 'Grace Hopper', email: 'grace@skylab.com' },
    ]);
  });

  it('drops applicants without an email so Skymail can take the list as-is', () => {
    const blank: Ticket = {
      id: 't-blank',
      eventId: 'e1',
      ticketType: 'GUEST',
      guestFirstName: 'No',
      guestLastName: 'Mail',
      checkIns: [],
      createdAt: '',
      updatedAt: '',
    };
    expect(ticketMailRecipients([blank], new Map())).toEqual([]);
  });
});
