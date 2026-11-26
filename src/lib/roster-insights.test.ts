import {
  formatClock,
  formatEntry,
  inRosterView,
  lastCheckInAt,
  recentRegistrations,
  registrationsByDay,
  rosterViewCounts,
} from './roster-insights';

const checkIn = (createdAt: string) => ({
  id: createdAt,
  ticketId: 't',
  sessionId: 's',
  eventDayId: 'd',
  createdAt,
});

describe('roster views', () => {
  const tickets = [
    { ticketType: 'REGISTERED', sent: true, checkIns: [checkIn('2026-11-22T09:00:00+03:00')] },
    { ticketType: 'GUEST', sent: false, checkIns: [] },
    { ticketType: 'GUEST', sent: true },
  ];

  it('counts each view', () => {
    expect(rosterViewCounts(tickets)).toEqual({
      all: 3,
      waiting: 2,
      'checked-in': 1,
      guest: 2,
      member: 1,
      unsent: 1,
    });
  });

  it('keeps an unknown mail state out of "Posta gitmedi"', () => {
    expect(inRosterView({ ticketType: 'GUEST' }, 'unsent')).toBe(false);
  });
});

describe('registrationsByDay', () => {
  it('fills empty days and keeps a running total', () => {
    const rows = registrationsByDay(
      [
        { createdAt: '2026-11-01T10:00:00Z' },
        { createdAt: '2026-11-01T12:00:00Z' },
        { createdAt: '2026-11-03T10:00:00Z' },
      ],
      new Date('2026-11-03T20:00:00Z'),
    );
    expect(rows.map((row) => [row.date, row.count, row.total])).toEqual([
      ['2026-11-01', 2, 2],
      ['2026-11-02', 0, 2],
      ['2026-11-03', 1, 3],
    ]);
    expect(rows[0].label).toBe('1 Kas');
  });

  it('starts the window with what came before it', () => {
    const rows = registrationsByDay(
      [{ createdAt: '2026-10-01T10:00:00Z' }, { createdAt: '2026-11-20T10:00:00Z' }],
      new Date('2026-11-20T12:00:00Z'),
      3,
    );
    expect(rows).toHaveLength(3);
    expect(rows[0].total).toBe(1);
    expect(rows[2].total).toBe(2);
  });

  it('is empty without registrations', () => {
    expect(registrationsByDay([])).toEqual([]);
  });
});

it('counts the last seven days', () => {
  expect(
    recentRegistrations(
      [{ createdAt: '2026-11-20T10:00:00Z' }, { createdAt: '2026-11-01T10:00:00Z' }],
      new Date('2026-11-22T10:00:00Z'),
    ),
  ).toBe(1);
});

it('finds the latest entry and writes its time', () => {
  const latest = lastCheckInAt({
    checkIns: [checkIn('2026-11-22T09:00:00+03:00'), checkIn('2026-11-22T13:30:00+03:00')],
  });
  expect(latest).toBe('2026-11-22T13:30:00+03:00');
  expect(formatClock(latest!)).toBe('22 Kas 13:30');
  expect(lastCheckInAt({})).toBeNull();
});

it('writes an entry today by its time, another day with the day', () => {
  const now = new Date('2026-11-22T15:00:00+03:00');
  expect(formatEntry('2026-11-22T09:12:00+03:00', now)).toBe('09:12');
  expect(formatEntry('2026-11-21T09:12:00+03:00', now)).toBe('21 Kas 09:12');
  expect(formatEntry('', now)).toBe('—');
});
