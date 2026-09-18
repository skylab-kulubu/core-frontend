import {
  eventFormIssue,
  eventListSubtitle,
  eventsByDateKey,
  eventsOnDateKey,
  filterEventsByPhase,
  formatEventWhen,
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
});

describe('event list labels', () => {
  it('puts team, place, when, and pasif together', () => {
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
    ).toMatch(/GECEKODU · YTÜ · .+ · pasif/);
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

describe('filterEventsByPhase', () => {
  it('keeps upcoming, past, and active slices separate', () => {
    const now = new Date('2026-09-19T12:00:00+03:00');
    const rows = [
      { id: 'past', name: 'Eski', startDate: '2026-01-01T10:00:00+03:00', active: true },
      { id: 'next', name: 'Yakın', startDate: '2026-10-01T10:00:00+03:00', active: false },
      { id: 'on', name: 'Açık', active: true },
    ];
    expect(filterEventsByPhase(rows, 'upcoming', now).map((row) => row.id)).toEqual(['next']);
    expect(filterEventsByPhase(rows, 'past', now).map((row) => row.id)).toEqual(['past']);
    expect(filterEventsByPhase(rows, 'active', now).map((row) => row.id)).toEqual(['past', 'on']);
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
