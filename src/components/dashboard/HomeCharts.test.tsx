import { render, screen } from '@testing-library/react';
import React from 'react';
import HomeCharts from '@/components/dashboard/HomeCharts';
import type { DashboardHome, DashboardSummary } from '@/lib/api/dashboard';

// The chart library draws nothing in jsdom; a stand-in names each chart and its series
jest.mock('@skylab-kulubu/skylcn-ui/charts', () => {
  const Chart = ({
    title,
    series,
  }: {
    title: string;
    series: Record<string, { label: string }>;
  }) => (
    <figure aria-label={title}>
      {Object.values(series)
        .map((s) => s.label)
        .join(', ')}
    </figure>
  );
  return { BarChart: Chart, LineChart: Chart };
});
jest.mock('./GithubActivitySection', () => ({
  GithubActivitySection: () => <div>GitHub</div>,
}));

const now = new Date('2026-11-22T12:00:00Z');

const home: DashboardHome = {
  todo: null,
  week: { from: '', to: '', events: [], sessions: [] },
  compare: {
    days: 30,
    applications: { current: 40, previous: 25 },
    attendees: { current: 12, previous: 18 },
    events: { current: 3, previous: 2 },
    newMembers: null,
  },
  daily: Array.from({ length: 60 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 8, 24 + i, 12)).toISOString().slice(0, 10),
    applications: i % 4,
    attendees: i % 2,
  })),
  monthly: [{ month: '2026-11', applications: 40, attendees: 12, events: 3 }],
  teams: [
    { team: 'GECEKODU', events: 4, applications: 120, attendees: 88 },
    { team: 'WEBLAB', events: 2, applications: 30, attendees: 10 },
  ],
  sessions: 7,
  certificates: null,
  season: {
    id: 's',
    name: '2026-2027',
    startDate: '2026-09-01T00:00:00Z',
    endDate: '2027-06-30T00:00:00Z',
    events: [
      { id: 'e', name: 'Hackathon', ownerTeam: 'GECEKODU', startDate: '2026-11-22T06:00:00Z' },
    ],
  },
  club: {
    eventsByMonth: [{ month: '2026-11', count: 4 }],
    eventsByTeam: [{ team: 'GECEKODU', count: 4 }],
  },
};

const summary: DashboardSummary = {
  generatedAt: now.toISOString(),
  timeZone: 'Europe/Istanbul',
  ownerTeams: ['GECEKODU', 'WEBLAB'],
  events: { total: 8, upcoming: 3, live: 1, byMonth: [] },
  applications: { total: 63, members: 41, guests: 22, checkedIn: 27, daily: [] },
  eventStats: [
    {
      id: 'e',
      name: 'Hackathon',
      ownerTeam: 'GECEKODU',
      location: '',
      startDate: '2026-11-22T06:00:00Z',
      active: true,
      live: true,
      capacity: 120,
      hasApplicationForm: true,
      hasCoverImage: true,
      applications: 42,
      members: 28,
      guests: 14,
      checkedIn: 21,
      dailyApplications: [],
    },
  ],
  members: null,
  home,
};

it('draws the figures and the charts of a reader with Events in scope', () => {
  render(<HomeCharts summary={summary} home={home} privileged now={now} />);
  expect(screen.getByRole('link', { name: /Başvuru/ })).toHaveTextContent('40');
  expect(screen.getByRole('figure', { name: 'Başvurular' })).toHaveTextContent(
    'Son 30 gün, Önceki 30 gün',
  );
  expect(screen.getByRole('figure', { name: 'Katılım' })).toBeInTheDocument();
  expect(screen.getByRole('figure', { name: 'Aylık başvuru ve katılım' })).toBeInTheDocument();
  expect(screen.getByRole('figure', { name: 'Ekiplere göre' })).toHaveTextContent(
    'Başvuru, Katılım',
  );
  expect(
    screen.getByRole('figure', { name: 'Etkinliklerde başvuru ve katılım' }),
  ).toBeInTheDocument();
  // The guest/member split as bars with counts, not a ring
  expect(screen.getByText('Misafir')).toBeInTheDocument();
  expect(screen.getAllByText(/2026-2027/).length).toBeGreaterThan(0);
  expect(screen.getByText('GitHub')).toBeInTheDocument();
});

it('gives a Member the club: the season and the club’s Events, no figures', () => {
  const member = {
    ...summary,
    ownerTeams: [],
    eventStats: [],
    members: null,
    home: { ...home, compare: null, daily: [], monthly: [], teams: [] },
  };
  render(<HomeCharts summary={member} home={member.home} privileged={false} now={now} />);
  expect(screen.queryByRole('link', { name: /Başvuru/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('figure', { name: 'Başvurular' })).not.toBeInTheDocument();
  expect(screen.getByRole('figure', { name: 'Aylık etkinlik' })).toBeInTheDocument();
  expect(screen.getByRole('figure', { name: 'Ekiplere göre etkinlik' })).toBeInTheDocument();
  expect(screen.getAllByText(/2026-2027/).length).toBeGreaterThan(0);
  expect(screen.queryByText('GitHub')).not.toBeInTheDocument();
});
