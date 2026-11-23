import { monthAgenda, monthWeeks, weekBars } from '@/lib/event-calendar';

const ev = (id: string, startDate?: string, endDate?: string) => ({
  id,
  name: id,
  startDate,
  endDate,
});

describe('monthWeeks', () => {
  it('lays November 2026 out from Monday 26 October to Sunday 6 December', () => {
    const weeks = monthWeeks(2026, 10);
    expect(weeks).toHaveLength(6);
    expect(weeks[0][0].key).toBe('2026-10-26');
    expect(weeks[0][0].inMonth).toBe(false);
    expect(weeks[0][6].key).toBe('2026-11-01');
    expect(weeks[5][6].key).toBe('2026-12-06');
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });
});

describe('weekBars', () => {
  const week = monthWeeks(2026, 10)[3]; // 16–22 November

  it('draws an Event over several days as one bar and marks where it runs on', () => {
    const { bars } = weekBars(
      [ev('kamp', '2026-11-20T10:00:00+03:00', '2026-11-24T18:00:00+03:00')],
      week,
    );
    expect(bars).toEqual([
      expect.objectContaining({ start: 4, span: 3, lane: 0, before: false, after: true }),
    ]);
  });

  it('puts overlapping Events in lanes and counts the ones past the last lane', () => {
    const day = '2026-11-18T10:00:00+03:00';
    const { bars, hidden } = weekBars(
      [ev('a', day), ev('b', day), ev('c', day), ev('d', day)],
      week,
      3,
    );
    expect(bars.map((bar) => bar.lane).sort()).toEqual([0, 1, 2]);
    expect(hidden[2]).toBe(1);
    expect(hidden.filter(Boolean)).toHaveLength(1);
  });

  it('leaves out undated Events and ones outside the week', () => {
    const { bars } = weekBars([ev('x'), ev('y', '2026-11-02T10:00:00+03:00')], week);
    expect(bars).toEqual([]);
  });
});

describe('monthAgenda', () => {
  it('lists each day that has an Event, an Event over days on each of them', () => {
    const agenda = monthAgenda(
      [
        ev('kamp', '2026-11-29T10:00:00+03:00', '2026-12-01T10:00:00+03:00'),
        ev('tek', '2026-11-03T10:00:00+03:00'),
      ],
      2026,
      10,
    );
    expect(agenda.map((day) => [day.key, day.events.map((e) => e.id)])).toEqual([
      ['2026-11-03', ['tek']],
      ['2026-11-29', ['kamp']],
      ['2026-11-30', ['kamp']],
    ]);
  });
});
