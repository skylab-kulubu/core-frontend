import {
  attendanceFinalizeOpen,
  eventEndsAt,
  eventFormIssue,
  eventGapLine,
  eventGaps,
  sortEvents,
  countEventsByStatus,
  eventDisplayStatus,
  eventListSubtitle,
  eventStatusFilterFrom,
  eventsByDateKey,
  eventsOnDateKey,
  filterEventsByStatus,
  formatEventWhen,
  formatEventWhenShort,
  sortEventsForList,
  undatedEvents,
} from './events-view';

describe('eventFormIssue', () => {
  it('asks for name and location', () => {
    expect(eventFormIssue({ name: '', location: 'YTÜ' })).toBe('Etkinlik adı gerekli.');
    expect(eventFormIssue({ name: 'Hack', location: '  ' })).toBe('Konum gerekli.');
  });

  it('rejects an end before start', () => {
    expect(
      eventFormIssue({
        name: 'Hack',
        location: 'YTÜ',
        startDate: '2026-09-20T18:00',
        endDate: '2026-09-19T18:00',
      }),
    ).toBe('Bitiş, başlangıçtan önce olamaz.');
  });

  it('accepts a same-day range', () => {
    expect(
      eventFormIssue({
        name: 'Hack',
        location: 'YTÜ',
        startDate: '2026-09-20T10:00',
        endDate: '2026-09-20T18:00',
      }),
    ).toBeNull();
  });

  it('asks for the accent as #RRGGBB; empty is the theme’s', () => {
    const base = { name: 'ARTLAB', location: 'Hamam' };
    expect(eventFormIssue({ ...base, ticketAccentColor: '#F5B8' })).toBe(
      'Vurgu rengi #RRGGBB biçiminde olmalı.',
    );
    expect(eventFormIssue({ ...base, ticketAccentColor: ' #f5b82e ' })).toBeNull();
    expect(eventFormIssue({ ...base, ticketAccentColor: null })).toBeNull();
  });
});

describe('event list labels', () => {
  it('puts team, place and when together; the status is the chip, not the subtitle', () => {
    expect(
      eventListSubtitle({
        id: 'e1',
        name: 'Gecekodu',
        ownerTeam: 'GECEKODU',
        location: 'YTÜ',
        active: false,
        startDate: '2026-09-19T18:00:00+03:00',
        endDate: '2026-09-19T22:00:00+03:00',
      }),
    ).toMatch(/^GECEKODU · YTÜ · [^·]+$/);
  });

  it('formats a multi-day span', () => {
    const label = formatEventWhen({
      id: 'e1',
      name: 'ARTLAB',
      startDate: '2026-04-10T10:00:00+03:00',
      endDate: '2026-04-11T18:00:00+03:00',
    });
    expect(label).toContain(' – ');
    expect(label).toMatch(/10/);
    expect(label).toMatch(/11/);
  });
});

describe('event list sort', () => {
  it('keeps upcoming before undated before past', () => {
    const now = new Date('2026-09-19T12:00:00+03:00');
    const rows = sortEventsForList(
      [
        { id: 'past', name: 'Eski', startDate: '2026-01-01T10:00:00+03:00' },
        { id: 'none', name: 'Tarihsiz' },
        { id: 'next', name: 'Yakın', startDate: '2026-10-01T10:00:00+03:00' },
      ],
      now,
    );
    expect(rows.map((row) => row.id)).toEqual(['next', 'none', 'past']);
  });
});

describe('event display status (SPEC §2.6)', () => {
  const now = new Date('2026-09-19T12:00:00+03:00');
  const past = { startDate: '2026-09-01T10:00:00+03:00', endDate: '2026-09-01T18:00:00+03:00' };
  const running = { startDate: '2026-09-19T10:00:00+03:00', endDate: '2026-09-19T18:00:00+03:00' };
  const next = { startDate: '2026-10-01T10:00:00+03:00' };

  it.each([
    ['draft', { status: 'draft', ...running }, 'draft'],
    ['draft without dates', { status: 'draft' }, 'draft'],
    ['cancelled', { status: 'cancelled', ...next }, 'cancelled'],
    ['cancelled after its end', { status: 'cancelled', ...past }, 'cancelled'],
    ['published, to come', { status: 'published', ...next }, 'upcoming'],
    ['published, running', { status: 'published', ...running }, 'live'],
    ['published, ended', { status: 'published', ...past }, 'ended'],
    ['published, undated', { status: 'published' }, 'undated'],
    ['no status (older core)', { ...running }, 'live'],
    [
      'start only, within its day',
      { status: 'published', startDate: '2026-09-19T10:00:00+03:00' },
      'live',
    ],
    [
      'start only, a day on',
      { status: 'published', startDate: '2026-09-18T11:00:00+03:00' },
      'ended',
    ],
  ])('%s', (_name, event, expected) => {
    expect(eventDisplayStatus(event, now)).toBe(expected);
  });

  const rows = [
    { id: 'd', name: 'Taslak', status: 'draft', ...next },
    { id: 'u', name: 'Yakın', status: 'published', ...next },
    { id: 'l', name: 'Şimdi', status: 'published', ...running },
    { id: 'p', name: 'Eski', status: 'published', ...past },
    { id: 'n', name: 'Tarihsiz', status: 'published' },
    { id: 'c', name: 'İptal', status: 'cancelled', ...running },
  ];

  it('filters each slice by status; an undated published event is only in Tümü', () => {
    const ids = (filter: Parameters<typeof filterEventsByStatus>[1]) =>
      filterEventsByStatus(rows, filter, now).map((row) => row.id);
    expect(ids('all')).toEqual(['d', 'u', 'l', 'p', 'n', 'c']);
    expect(ids('draft')).toEqual(['d']);
    expect(ids('upcoming')).toEqual(['u']);
    expect(ids('live')).toEqual(['l']);
    expect(ids('past')).toEqual(['p']);
    expect(ids('cancelled')).toEqual(['c']);
  });

  it('counts every slice', () => {
    expect(countEventsByStatus(rows, now)).toEqual({
      all: 6,
      draft: 1,
      upcoming: 1,
      live: 1,
      past: 1,
      cancelled: 1,
    });
  });

  it('reads the filter from the address, Tümü for anything else', () => {
    expect(eventStatusFilterFrom('cancelled')).toBe('cancelled');
    expect(eventStatusFilterFrom('active')).toBe('all');
    expect(eventStatusFilterFrom(null)).toBe('all');
  });
});

describe('event end (core rule)', () => {
  const now = new Date('2026-09-19T12:00:00+03:00');

  it('ends at the end date, else a day after the start, and never when undated', () => {
    expect(
      eventEndsAt({
        startDate: '2026-09-19T10:00:00+03:00',
        endDate: '2026-09-19T11:00:00+03:00',
      }),
    ).toBe(Date.parse('2026-09-19T11:00:00+03:00'));
    expect(eventEndsAt({ startDate: '2026-09-19T10:00:00+03:00' })).toBe(
      Date.parse('2026-09-20T10:00:00+03:00'),
    );
    expect(eventEndsAt({})).toBeNull();
  });

  it('keeps a start-only event running for a day after its start', () => {
    const rows = [
      { id: 'today', name: 'Bugün', startDate: '2026-09-19T10:00:00+03:00' },
      { id: 'yesterday', name: 'Dün', startDate: '2026-09-18T11:00:00+03:00' },
    ];
    expect(filterEventsByStatus(rows, 'live', now).map((row) => row.id)).toEqual(['today']);
    expect(filterEventsByStatus(rows, 'past', now).map((row) => row.id)).toEqual(['yesterday']);
  });

  it('opens attendance finalization for a published event that ended or is undated', () => {
    const ended = { startDate: '2026-09-18T11:00:00+03:00' };
    const running = { startDate: '2026-09-19T10:00:00+03:00' };
    expect(attendanceFinalizeOpen({ status: 'published', ...ended }, now)).toBe(true);
    expect(attendanceFinalizeOpen({ status: 'published' }, now)).toBe(true);
    expect(attendanceFinalizeOpen({ status: 'published', ...running }, now)).toBe(false);
    expect(attendanceFinalizeOpen({ status: 'draft', ...ended }, now)).toBe(false);
    expect(attendanceFinalizeOpen({ status: 'cancelled' }, now)).toBe(false);
  });
});

describe('month occupancy', () => {
  const artlab = {
    id: 'a1',
    name: 'ARTLAB',
    startDate: '2026-04-10T10:00:00+03:00',
    endDate: '2026-04-11T18:00:00+03:00',
  };

  it('places a spanning event on each local day', () => {
    const map = eventsByDateKey([artlab], 2026, 3);
    expect(eventsOnDateKey([artlab], '2026-04-10').map((row) => row.id)).toEqual(['a1']);
    expect(eventsOnDateKey([artlab], '2026-04-11').map((row) => row.id)).toEqual(['a1']);
    expect(map.get('2026-04-10')?.map((row) => row.id)).toEqual(['a1']);
    expect(map.get('2026-04-11')?.map((row) => row.id)).toEqual(['a1']);
    expect(map.get('2026-04-12')).toBeUndefined();
  });

  it('keeps undated events off the grid', () => {
    expect(undatedEvents([{ id: 'x', name: 'Taslak' }, artlab]).map((row) => row.id)).toEqual([
      'x',
    ]);
  });
});

describe('eventGaps', () => {
  const now = new Date('2026-11-23T12:00:00+03:00');
  const base = { status: 'draft', location: 'YTÜ', startDate: '2026-12-01T10:00:00+03:00' };

  it('names what a draft lacks in the order it is filled in', () => {
    expect(eventGaps({ ...base, location: '', startDate: undefined }, now)).toEqual([
      'date',
      'place',
      'cover',
      'form',
    ]);
    expect(eventGapLine(['date', 'place', 'cover', 'form'])).toBe('Tarih, yer +2 eksik');
    expect(eventGapLine(['cover'])).toBe('Kapak eksik');
  });

  it('counts an extra form as a form', () => {
    expect(
      eventGaps(
        { ...base, coverImageUrl: 'c.png', extraFormUrls: [{ label: 'x', url: 'y' }] },
        now,
      ),
    ).toEqual([]);
  });

  it('warns about nothing once the Event is over or cancelled', () => {
    expect(
      eventGaps({ ...base, status: 'published', startDate: '2026-11-01T10:00:00+03:00' }, now),
    ).toEqual([]);
    expect(eventGaps({ ...base, status: 'cancelled' }, now)).toEqual([]);
  });
});

describe('sortEvents', () => {
  const rows = [
    { id: 'a', name: 'Bilgi', startDate: '2026-10-01T10:00:00+03:00' },
    { id: 'b', name: 'Ağ', startDate: '2026-12-01T10:00:00+03:00' },
    { id: 'c', name: 'Çay' },
  ];
  it('sorts by newest start with the undated last, by name, by registrations', () => {
    expect(sortEvents(rows, 'newest').map((r) => r.id)).toEqual(['b', 'a', 'c']);
    expect(sortEvents(rows, 'name').map((r) => r.id)).toEqual(['b', 'a', 'c']);
    const counts: Record<string, number> = { a: 3, b: 1, c: 9 };
    expect(sortEvents(rows, 'registrations', (r) => counts[r.id]).map((r) => r.id)).toEqual([
      'c',
      'a',
      'b',
    ]);
  });
});

describe('formatEventWhenShort', () => {
  it('writes a span within a month, across months and on one day short', () => {
    expect(
      formatEventWhenShort({
        startDate: '2026-11-22T09:00:00+03:00',
        endDate: '2026-11-23T18:00:00+03:00',
      }),
    ).toBe('22–23 Kas 2026');
    expect(
      formatEventWhenShort({
        startDate: '2026-11-30T09:00:00+03:00',
        endDate: '2026-12-02T18:00:00+03:00',
      }),
    ).toBe('30 Kas – 2 Ara 2026');
    expect(formatEventWhenShort({ startDate: '2026-12-03T18:00:00+03:00' })).toBe('3 Ara 2026');
    expect(formatEventWhenShort({})).toBe('');
  });
});
