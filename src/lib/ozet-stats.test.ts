import {
  displayCount,
  errorCount,
  eventActivity,
  eventsByMonth,
  okCount,
  sessionsByEvent,
} from './ozet-stats';

describe('displayCount', () => {
  it('does not render a silent zero', () => {
    expect(displayCount({ kind: 'loading' })).toBe('--');
    expect(displayCount(errorCount('boom'))).toBe('Hata');
    expect(displayCount(okCount(0))).toBe('Boş');
    expect(displayCount(okCount(12))).toBe('12');
  });
});

describe('sessionsByEvent', () => {
  it('ranks events by session count', () => {
    expect(
      sessionsByEvent([{ eventName: 'Jam' }, { eventName: 'Jam' }, { eventName: 'CTF' }]),
    ).toEqual([
      { label: 'Jam', count: 2 },
      { label: 'CTF', count: 1 },
    ]);
  });

  it('treats a missing event name as Etkinlik', () => {
    expect(sessionsByEvent([{ eventName: undefined as unknown as string }])).toEqual([
      { label: 'Etkinlik', count: 1 },
    ]);
  });
});

describe('eventsByMonth', () => {
  it('fills six months including empty ones', () => {
    const now = new Date(2026, 8, 18);
    const rows = eventsByMonth(
      [
        { startDate: new Date(2026, 8, 1).toISOString() },
        { startDate: new Date(2026, 6, 15).toISOString() },
      ],
      now,
    );
    expect(rows).toHaveLength(6);
    expect(rows[rows.length - 1]?.count).toBe(1);
    expect(rows.some((row) => row.count === 0)).toBe(true);
  });
});

describe('eventActivity', () => {
  it('splits active upcoming and past', () => {
    const now = new Date('2026-09-18T12:00:00Z');
    expect(
      eventActivity(
        [
          { active: true, startDate: '2026-10-01' },
          { active: false, startDate: '2026-01-01' },
          { active: true },
        ],
        now,
      ),
    ).toEqual([
      { label: 'Aktif', count: 2 },
      { label: 'Yaklaşan', count: 1 },
      { label: 'Geçmiş', count: 1 },
    ]);
  });
});
