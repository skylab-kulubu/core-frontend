import type { CoreEvent } from '@/lib/api/events';
import type { Season } from '@/lib/api/seasons';
import { currentSeason, seasonWheel } from './season';

const NOW = new Date('2026-10-15T12:00:00');

function season(id: string, startDate?: string, endDate?: string): Season {
  return { id, name: id, startDate, endDate, active: true, createdAt: '', updatedAt: '' };
}

function event(id: string, startDate: string, endDate?: string): CoreEvent {
  return {
    id,
    name: `Etkinlik ${id}`,
    description: '',
    location: '',
    ownerTeam: 'WEBLAB',
    capacity: 0,
    startDate,
    endDate,
    active: true,
    ranked: false,
    createdAt: '',
    updatedAt: '',
  };
}

const FALL = season('Güz', '2026-09-14T00:00:00', '2026-12-31T00:00:00');

describe('currentSeason', () => {
  it('takes the season running now', () => {
    const spring = season('Bahar', '2026-02-09T00:00:00', '2026-06-12T00:00:00');
    expect(currentSeason([spring, FALL], NOW)).toBe(FALL);
  });

  it('falls back to the season that ended last, and skips undated ones', () => {
    const old = season('Eski', '2025-09-01T00:00:00', '2026-01-10T00:00:00');
    const spring = season('Bahar', '2026-02-09T00:00:00', '2026-06-12T00:00:00');
    const summer = new Date('2026-07-01T12:00:00');
    expect(currentSeason([old, spring, season('Taslak')], summer)).toBe(spring);
  });

  it('answers null when no season can be drawn', () => {
    expect(currentSeason([season('Taslak')], NOW)).toBeNull();
    expect(currentSeason([], NOW)).toBeNull();
  });
});

describe('seasonWheel', () => {
  it('counts the weeks, places today and labels the months', () => {
    const wheel = seasonWheel(FALL, [], NOW);
    expect(wheel.weeks).toBe(16);
    expect(wheel.now).toBeCloseTo(4.5, 0);
    expect(wheel.ended).toBe(false);
    expect(wheel.months.map((month) => month.label)).toEqual(['Eyl', 'Eki', 'Kas', 'Ara']);
  });

  it('places events by week, stacks a shared week and marks what is over', () => {
    const wheel = seasonWheel(
      FALL,
      [
        event('b', '2026-10-17T10:00:00'),
        event('a', '2026-09-15T10:00:00', '2026-09-15T18:00:00'),
        event('c', '2026-10-16T10:00:00'),
        event('outside', '2027-03-01T10:00:00'),
        event('undated', ''),
      ],
      NOW,
    );
    expect(wheel.events.map((e) => [e.id, e.week, e.stack, e.past])).toEqual([
      ['a', 0, 0, true],
      ['c', 4, 0, false],
      ['b', 4, 1, false],
    ]);
  });

  it('knows a season is over once its last day has passed', () => {
    expect(seasonWheel(FALL, [], new Date('2027-01-05T12:00:00')).ended).toBe(true);
  });
});
