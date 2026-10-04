import type { EventStat } from '@/lib/api/dashboard';
import { attentionItems, busiestDay, featuredEvent, monthCounts, upcomingStats } from './insights';

const NOW = new Date('2026-10-03T12:00:00');

function stat(id: string, startDate: string, extra: Partial<EventStat> = {}): EventStat {
  return {
    id,
    name: `Etkinlik ${id}`,
    ownerTeam: 'WEBLAB',
    location: '',
    startDate,
    active: true,
    live: false,
    capacity: 0,
    hasApplicationForm: true,
    hasCoverImage: true,
    applications: 0,
    members: 0,
    guests: 0,
    checkedIn: 0,
    dailyApplications: [],
    ...extra,
  };
}

describe('featuredEvent', () => {
  it('prefers the event core marks as running', () => {
    const running = stat('a', '2026-10-03T10:00:00', { live: true });
    expect(featuredEvent([stat('b', '2026-10-05T10:00:00'), running], NOW)).toBe(running);
  });

  it('falls back to the nearest upcoming event', () => {
    const sooner = stat('b', '2026-10-05T10:00:00');
    expect(
      featuredEvent(
        [stat('a', '2026-10-20T10:00:00'), sooner, stat('c', '2026-09-20T10:00:00')],
        NOW,
      ),
    ).toBe(sooner);
  });

  it('returns null when nothing is running or coming', () => {
    expect(featuredEvent([stat('a', '2026-09-20T10:00:00')], NOW)).toBeNull();
  });
});

describe('upcomingStats', () => {
  it('keeps the events still to start, soonest first', () => {
    const later = stat('a', '2026-10-20T10:00:00');
    const sooner = stat('b', '2026-10-05T10:00:00');
    expect(upcomingStats([later, stat('c', '2026-09-20T10:00:00'), sooner], NOW)).toEqual([
      sooner,
      later,
    ]);
  });
});

describe('attentionItems', () => {
  it('flags the next 30 days’ events without a form, nearly full or without a cover', () => {
    const noForm = stat('a', '2026-10-10T10:00:00', { hasApplicationForm: false });
    const full = stat('b', '2026-10-12T10:00:00', {
      capacity: 10,
      applications: 9,
      hasCoverImage: false,
    });
    const fine = stat('c', '2026-10-15T10:00:00');
    const far = stat('d', '2026-12-15T10:00:00', { hasApplicationForm: false });
    expect(
      attentionItems([full, fine, noForm, far], NOW).map((item) => [
        item.id,
        item.tone,
        item.messages,
      ]),
    ).toEqual([
      ['a', 'warning', ['Başvuru formu bağlanmamış']],
      ['b', 'warning', ["Kontenjanın %90'i dolu", 'Kapak görseli yok']],
    ]);
  });
});

describe('monthCounts', () => {
  it('labels months in Turkish', () => {
    expect(monthCounts([{ month: '2026-10', count: 3 }])).toEqual([{ label: 'Eki', count: 3 }]);
  });
});

describe('busiestDay', () => {
  const days = (counts: number[]) =>
    counts.map((count, index) => ({
      date: `2026-10-${String(index + 1).padStart(2, '0')}`,
      count,
    }));

  it('names the event that took most of the busiest day', () => {
    const daily = days([0, 3, 0, 64, 10]);
    const robotics = stat('r', '2026-10-21T10:00:00', {
      name: 'Robotik',
      dailyApplications: [0, 1, 0, 50, 4],
    });
    const jam = stat('j', '2026-10-26T10:00:00', {
      name: 'Oyun jam',
      dailyApplications: [0, 2, 0, 14, 6],
    });
    expect(busiestDay(daily, [jam, robotics])).toEqual({
      date: '2026-10-04',
      count: 64,
      eventName: 'Robotik',
    });
  });

  it('leaves the event out when the day is older than what events carry', () => {
    const daily = days([40, 0, 0, 1]);
    const short = stat('s', '2026-10-21T10:00:00', { dailyApplications: [0, 1] });
    expect(busiestDay(daily, [short])).toEqual({
      date: '2026-10-01',
      count: 40,
      eventName: undefined,
    });
  });

  it('answers null for a month without applications', () => {
    expect(busiestDay(days([0, 0, 0]), [])).toBeNull();
  });
});
