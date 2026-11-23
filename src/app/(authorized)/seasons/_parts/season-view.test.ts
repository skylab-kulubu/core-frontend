import {
  eventsByMonth,
  progressText,
  seasonFigures,
  seasonHref,
  seasonProgress,
  seasonRange,
  seasonSection,
} from './season-view';

const season = {
  startDate: '2026-09-28T00:00:00+03:00',
  endDate: '2027-05-31T23:59:00+03:00',
};

describe('season view', () => {
  it('writes the range in days, and says what is missing', () => {
    expect(seasonRange(season)).toBe('28 Eyl 2026 – 31 May 2027');
    expect(seasonRange({ startDate: season.startDate })).toBe('28 Eyl 2026 –');
    expect(seasonRange({})).toBe('');
  });

  it('places today in the season: before, during, after, or nowhere without dates', () => {
    expect(progressText(seasonProgress(season, new Date('2026-09-18T12:00:00+03:00')))).toBe(
      '10 gün sonra başlar',
    );
    const running = seasonProgress(season, new Date('2026-11-23T12:00:00+03:00'));
    expect(running).toMatchObject({ phase: 'running', day: 57, days: 246 });
    expect(progressText(running)).toBe('57. gün / 246');
    expect(running.phase === 'running' && running.percent).toBe(23);
    expect(progressText(seasonProgress(season, new Date('2027-07-01T00:00:00Z')))).toBe('Bitti');
    expect(seasonProgress({}, new Date()).phase).toBe('undated');
  });

  it('counts the season’s events, and sums only their applications and entries', () => {
    const now = new Date('2026-11-23T12:00:00+03:00');
    const events = [
      { id: 'a', startDate: '2026-10-03T18:00:00+03:00', endDate: '2026-10-03T20:00:00+03:00' },
      { id: 'b', startDate: '2026-12-03T18:00:00+03:00' },
    ];
    const stats = [
      { id: 'a', applications: 60, checkedIn: 40 },
      { id: 'b', applications: 10, checkedIn: 0 },
      { id: 'other', applications: 999, checkedIn: 999 },
    ];
    expect(seasonFigures(events, stats, now)).toEqual({
      events: 2,
      past: 1,
      applications: 70,
      attendees: 40,
    });
    expect(seasonFigures(events, null, now)).toMatchObject({ applications: null, attendees: null });
  });

  it('lists every month of the season with its events, empty months too', () => {
    const rows = eventsByMonth(season, [
      { startDate: '2026-10-03T18:00:00+03:00' },
      { startDate: '2026-11-08T19:00:00+03:00' },
      { startDate: '2026-11-22T09:00:00+03:00' },
    ]);
    expect(rows).toHaveLength(9);
    expect(rows.slice(0, 3)).toEqual([
      { label: 'Eyl', count: 0 },
      { label: 'Eki', count: 1 },
      { label: 'Kas', count: 2 },
    ]);
    expect(rows.at(-1)).toEqual({ label: 'May', count: 0 });
  });

  it('keeps the open section in the address', () => {
    expect(seasonSection('ayarlar')).toBe('ayarlar');
    expect(seasonSection('nope')).toBe('genel');
    expect(seasonHref('s 1')).toBe('/seasons/s%201');
    expect(seasonHref('s1', 'etkinlikler')).toBe('/seasons/s1?bolum=etkinlikler');
  });
});
