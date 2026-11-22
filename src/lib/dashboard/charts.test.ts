import type { DashboardHome, DashboardSummary, EventStat } from '@/lib/api/dashboard';
import {
  clubTeamRows,
  dailyComparison,
  eventConversion,
  kpis,
  monthLabel,
  teamRows,
} from './charts';

const now = new Date('2026-11-22T12:00:00Z');

const days = (n: number, start: string) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(`${start}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });

const home: DashboardHome = {
  todo: null,
  week: { from: '', to: '', events: [], sessions: [] },
  compare: {
    days: 30,
    applications: { current: 40, previous: 25 },
    attendees: { current: 12, previous: 18 },
    events: { current: 3, previous: 0 },
    newMembers: { current: 9, previous: 4 },
  },
  daily: days(60, '2026-09-24').map((date, i) => ({ date, applications: i, attendees: i % 3 })),
  monthly: [
    { month: '2026-10', applications: 30, attendees: 20, events: 2 },
    { month: '2026-11', applications: 40, attendees: 12, events: 3 },
  ],
  teams: [
    { team: 'GECEKODU', events: 4, applications: 120, attendees: 88 },
    { team: '', events: 1, applications: 10, attendees: 4 },
  ],
  sessions: 37,
  certificates: { issued: 312, revoked: 2, period: { current: 40, previous: 12 } },
  season: null,
  club: {
    eventsByMonth: [],
    eventsByTeam: [
      { team: 'WEBLAB', count: 6 },
      { team: '', count: 1 },
    ],
  },
};

const summary: DashboardSummary = {
  generatedAt: now.toISOString(),
  timeZone: 'Europe/Istanbul',
  ownerTeams: ['GECEKODU'],
  events: { total: 8, upcoming: 3, live: 1, byMonth: [{ month: '2026-11', count: 4 }] },
  applications: {
    total: 63,
    members: 41,
    guests: 22,
    checkedIn: 27,
    daily: days(30, '2026-10-24').map((date) => ({ date, count: 2 })),
  },
  eventStats: [],
  members: {
    active: 187,
    newByMonth: [{ month: '2026-11', count: 9 }],
    recentJoiners: [],
    asOf: now.toISOString(),
  },
  home,
};

describe('kpis', () => {
  it('sets each figure against the 30 days before, with a trend', () => {
    const rows = kpis(summary, home);
    expect(rows.map((row) => row.label)).toEqual([
      'Başvuru',
      'Katılım',
      'Etkinlik',
      'Oturum',
      'Sertifika',
      'Yeni üye',
      'Aktif üye',
    ]);
    expect(rows[0]).toMatchObject({ value: 40, delta: '+%60', hint: 'Önceki 30 gün: 25' });
    expect(rows[0].trend).toHaveLength(30);
    expect(rows[1]).toMatchObject({ value: 12, delta: '−%33' });
    // Nothing to set a rise from zero against
    expect(rows[2].delta).toBeUndefined();
    expect(rows[4].hint).toBe('Önceki 30 gün: 12 · toplam 312');
  });

  it('gives a reader with no Event in scope and no people no figures', () => {
    const member = { ...summary, ownerTeams: [], members: null };
    expect(kpis(member, { ...home, compare: null, certificates: null })).toEqual([]);
  });

  it('falls back to the totals of an older core', () => {
    const rows = kpis({ ...summary, home: undefined }, undefined);
    expect(rows.map((row) => [row.label, row.value])).toEqual([
      ['Başvuru', 60],
      ['Etkinlik', 8],
      ['Aktif üye', 187],
    ]);
  });
});

describe('dailyComparison', () => {
  it('lays the 30 days before under the last 30, day by day', () => {
    const rows = dailyComparison(summary, home, 'applications');
    expect(rows).toHaveLength(30);
    expect(rows[0]).toEqual({ day: '24 Eki', current: 30, previous: 0 });
    expect(rows[29]).toEqual({ day: '22 Kas', current: 59, previous: 29 });
  });

  it('has only this period from an older core, and no attendance', () => {
    const rows = dailyComparison(summary, undefined, 'applications');
    expect(rows[0]).toEqual({ day: '24 Eki', current: 2, previous: null });
    expect(dailyComparison(summary, undefined, 'attendees')).toEqual([]);
  });
});

describe('eventConversion', () => {
  const stat = (partial: Partial<EventStat>): EventStat => ({
    id: 'x',
    name: 'X',
    ownerTeam: 'GECEKODU',
    location: '',
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
    ...partial,
  });

  it('lists the Events that began, latest first, with the share that came', () => {
    const rows = eventConversion(
      [
        stat({
          name: 'Seminer',
          startDate: '2026-11-08T16:00:00Z',
          applications: 12,
          checkedIn: 9,
        }),
        stat({
          name: 'Hackathon',
          startDate: '2026-11-22T06:00:00Z',
          applications: 42,
          checkedIn: 21,
        }),
        stat({ name: 'Atölye', startDate: '2026-12-03T15:00:00Z', applications: 9 }),
        stat({ name: 'Boş', startDate: '2026-11-01T15:00:00Z' }),
      ],
      now,
    );
    expect(rows).toEqual([
      { label: 'Hackathon · %50', applications: 42, attendees: 21, rate: 50 },
      { label: 'Seminer · %75', applications: 12, attendees: 9, rate: 75 },
    ]);
  });
});

describe('teams', () => {
  it('names the club for Events without an Owner team', () => {
    expect(teamRows(home).map((row) => row.label)).toEqual(['GECEKODU · 4 etk.', 'Kulüp · 1 etk.']);
    expect(clubTeamRows(home)).toEqual([
      { label: 'WEBLAB', count: 6 },
      { label: 'Kulüp', count: 1 },
    ]);
  });

  it('draws no team chart for a single team', () => {
    expect(teamRows({ ...home, teams: home.teams.slice(0, 1) })).toEqual([]);
  });
});

it('labels months in Turkish', () => {
  expect(monthLabel('2026-11')).toBe('Kas');
  expect(monthLabel('2027-01')).toBe('Oca');
});
