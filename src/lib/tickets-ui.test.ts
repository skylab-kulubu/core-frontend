import type { Person } from '@/lib/api/identity';
import type { Ticket } from '@/lib/api/tickets';
import { ProblemError } from '@/lib/api/core';
import {
  filterApplicantRoster,
  normalizeTicketCode,
  ticketSendProblem,
  ticketDetailFields,
  ticketMailRecipients,
  ticketCrumbName,
  ticketRosterRow,
  canCancelEventTicket,
  isTicketCancelled,
  ticketCancelProblem,
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
  it('treats omitted check-ins and createdAt as kayıtlı with no date', () => {
    const row = ticketRosterRow(
      { id: 't-sparse', eventId: 'e1', ticketType: 'GUEST', guestFirstName: 'Ada' } as Ticket,
      new Map(),
      { id: 'e1' },
    );
    expect(row.name).toBe('Ada');
    expect(row.status).toBe('registered');
    expect(row.createdAtLabel).toBe('—');
  });

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
    expect(byLabel['Bilet e-postası']?.value).toBe('Hayır');
    expect(byLabel['Oluşturulma']?.value).toBe('Bugün, 08:05');
    expect(byLabel['Bilet kodu']?.group).toBe('Bilet');
    expect(fields.some((field) => field.value === 't-guest')).toBe(false);
    expect(byLabel['Etkinlik']?.value).toBe('SkyDays');
    expect(byLabel['Giriş']?.value).toBe('—');
    expect(byLabel['Ad']?.group).toBe('Kişi');
    expect(byLabel['Note']?.group).toBe('Formdaki diğer cevaplar');
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
    expect(byLabel['Açılış']).toEqual({ label: 'Açılış', value: 'Bugün, 09:00', group: 'Giriş' });
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

describe('Ticket code', () => {
  const coded = (id: string, code: string): Ticket => ({
    id,
    eventId: 'e1',
    ticketType: 'GUEST',
    guestFirstName: 'Ada',
    guestLastName: id,
    guestEmail: `${id}@example.com`,
    code,
    checkIns: [],
    createdAt: '2026-11-22T10:00:00.000Z',
    updatedAt: '2026-11-22T10:00:00.000Z',
  });
  const rows = [coded('a', 'K7M2-QX9F'), coded('b', 'B401-1N2D')];
  const search = (query: string) =>
    filterApplicantRoster(rows, new Map(), { query, ticketType: 'all', status: 'all' }).map(
      (row) => row.id,
    );

  it('reads a code as core does: no dash or space, upper case, O as 0, I and L as 1', () => {
    expect(normalizeTicketCode(' k7m2-qx9f ')).toBe('K7M2QX9F');
    expect(normalizeTicketCode('B4O1 iLNd')).toBe('B40111ND');
    expect(normalizeTicketCode('ıİ')).toBe('11');
  });

  it('finds a Ticket by its code, typed as a person reads it', () => {
    expect(search('K7M2-QX9F')).toEqual(['a']);
    expect(search('k7m2qx9f')).toEqual(['a']);
    expect(search('b4o1 ln2d')).toEqual(['b']);
    expect(search('QX9F')).toEqual(['a']);
    // Three characters are not a code: no match on codes alone
    expect(search('X9F')).toEqual([]);
  });

  it("says core's refusals of a resend in Turkish", () => {
    expect(
      ticketSendProblem(
        new ProblemError(409, 'Conflict', { code: 'ticket_notification_off' }),
        'x',
      ),
    ).toBe('Bilet postası kapalı; bilet gönderilemiyor.');
    expect(ticketSendProblem(new ProblemError(409, 'Conflict', { code: 'event_ended' }), 'x')).toBe(
      'Etkinlik bitmiş; bilet gönderilmez.',
    );
    expect(
      ticketSendProblem(
        new ProblemError(429, 'Too Many Requests', {
          code: 'ticket_resend_rate_limited',
          detail: 'Bu bilet son bir saatte 3 kez gönderildi.',
        }),
        'x',
      ),
    ).toBe('Bu bilet çok sık gönderildi (saatte 3, günde 6). Bir saat sonra tekrar dene.');
    expect(
      ticketSendProblem(
        new ProblemError(503, 'Service Unavailable', { code: 'audit_unavailable' }),
        'x',
      ),
    ).toBe('İşlem kaydı açılamadı; hiçbir şey gönderilmedi. Biraz sonra tekrar dene.');
    expect(
      ticketSendProblem(new ProblemError(409, 'Conflict', { code: 'ticket_holder_erased' }), 'x'),
    ).toBe('Bilet sahibinin hesabı silinmiş; gönderilecek kimse yok.');
  });
});

describe('ticketCrumbName', () => {
  it('names the applicant for the trail and the tab, never by e-mail or id', () => {
    expect(ticketCrumbName(ada, new Map())).toBe('Ada Lovelace');
    expect(ticketCrumbName({ ...ada, guestFirstName: '', guestLastName: '' }, new Map())).toBe(
      'Başvuru',
    );
    const member = { id: 't-m', eventId: 'e1', ticketType: 'MEMBER', ownerId: 'u1' } as Ticket;
    const people = new Map<string, Person>([
      ['u1', { id: 'u1', email: 'ada@example.com', firstName: '', lastName: '' }],
    ]);
    expect(ticketCrumbName(member, people)).toBe('Başvuru');
    expect(ticketCrumbName(member, new Map())).toBe('Başvuru');
  });
});

describe('ticket cancellation', () => {
  it('lets who edits the event cancel, never DK', () => {
    expect(canCancelEventTicket(['/UYELER/YK'], 'WEBLAB')).toBe(true);
    expect(canCancelEventTicket(['/UYELER/ADMIN'], 'WEBLAB')).toBe(true);
    expect(canCancelEventTicket(['/UYELER/DK'], 'WEBLAB')).toBe(false);
    expect(canCancelEventTicket(['/UYELER/ORGANIZASYON/WEBLAB/LIDERLER'], 'WEBLAB')).toBe(true);
    expect(canCancelEventTicket(['/UYELER/ORGANIZASYON/WEBLAB'], 'WEBLAB')).toBe(false);
    expect(canCancelEventTicket(['/UYELER/ORGANIZASYON/GECEKODU'], 'GECEKODU')).toBe(true);
  });

  it('reads the status core gives, a ticket without one as active', () => {
    expect(isTicketCancelled({ status: 'cancelled' })).toBe(true);
    expect(isTicketCancelled({ status: 'waitlisted' })).toBe(false);
    expect(isTicketCancelled({})).toBe(false);
  });

  it('says each refusal in Turkish', () => {
    const conflict = (code: string) => new ProblemError(409, 'Conflict', { code });
    expect(ticketCancelProblem(conflict('event_ended'), 'cancel')).toBe(
      'Etkinlik bitmiş; bilet iptal edilemez.',
    );
    expect(ticketCancelProblem(conflict('event_ended'), 'restore')).toBe(
      'Etkinlik bitmiş; bilet geri alınamaz.',
    );
    expect(ticketCancelProblem(conflict('ticket_waitlisted'), 'restore')).toBe(
      'Bilet bekleme listesinde; geri alınamaz.',
    );
    expect(ticketCancelProblem(new ProblemError(403, 'Forbidden'), 'restore')).toBe(
      'Bu bileti geri alma yetkin yok.',
    );
    expect(ticketCancelProblem(new Error('boom'), 'cancel')).toBe('Bilet iptal edilemedi');
  });
});
