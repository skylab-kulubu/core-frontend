import { render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import DashboardPage from '@/app/(authorized)/dashboard/page';
import { useAuth } from '@/context/AuthContext';
import { dashboardApi, type DashboardSummary } from '@/lib/api/dashboard';
import { ProblemError } from '@/lib/api/core';
import { ticketsApi } from '@/lib/api/tickets';

jest.mock('@/context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/api/dashboard', () => ({ dashboardApi: { summary: jest.fn() } }));
jest.mock('@/lib/api/tickets', () => ({ ticketsApi: { listDoorEvents: jest.fn() } }));
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
}));
// The charts load on their own (next/dynamic); here a stand-in that shows what it was given
jest.mock('next/dynamic', () => () => {
  function ChartsStandIn(props: { summary: { ownerTeams: string[] }; privileged: boolean }) {
    return (
      <div data-testid="charts">
        {props.summary.ownerTeams.join(',')}|{String(props.privileged)}
      </div>
    );
  }
  return ChartsStandIn;
});

const charts = {
  daily: [],
  monthly: [],
  teams: [],
  sessions: 0,
  certificates: null,
  season: null,
  club: { eventsByMonth: [], eventsByTeam: [] },
};

const base: DashboardSummary = {
  generatedAt: '2026-11-22T12:00:00Z',
  timeZone: 'Europe/Istanbul',
  ownerTeams: [],
  events: { total: 0, upcoming: 0, live: 0, byMonth: [] },
  applications: { total: 0, members: 0, guests: 0, checkedIn: 0, daily: [] },
  eventStats: [],
  members: null,
};

function signIn(groups: string[]) {
  (useAuth as jest.Mock).mockReturnValue({ user: { id: 'u1', groups, roles: [] } });
}

beforeEach(() => {
  (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([]);
  jest.useFakeTimers({
    now: new Date('2026-11-22T12:00:00Z'),
    doNotFake: ['setTimeout', 'queueMicrotask', 'nextTick'],
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

it('asks core once and shows the strip of to-dos and the week above the charts', async () => {
  signIn(['/YK']);
  (dashboardApi.summary as jest.Mock).mockResolvedValue({
    ...base,
    ownerTeams: ['GECEKODU'],
    home: {
      ...charts,
      todo: {
        drafts: [],
        incomplete: [],
        failedCertificates: [{ eventId: 'e3', eventName: 'Seminer', failed: 3 }],
        subjectRequests: { open: 1, overdue: 0 },
      },
      week: {
        from: '2026-11-21T21:00:00Z',
        to: '2026-11-28T21:00:00Z',
        events: [
          {
            id: 'e1',
            name: 'Hackathon',
            ownerTeam: 'GECEKODU',
            location: 'Salon',
            startDate: '2026-11-22T15:00:00Z',
            live: false,
          },
        ],
        sessions: [],
      },
      compare: {
        days: 30,
        applications: { current: 40, previous: 25 },
        attendees: { current: 12, previous: 18 },
        events: { current: 3, previous: 2 },
        newMembers: { current: 9, previous: 4 },
      },
    },
  } satisfies DashboardSummary);
  render(<DashboardPage />);

  await screen.findByRole('link', { name: /1 KVKK başvurusu yanıt bekliyor/ });
  const todo = screen.getByRole('region', { name: /^Yapılacaklar/ });
  expect(
    within(todo).getByRole('link', { name: /1 KVKK başvurusu yanıt bekliyor/ }),
  ).toHaveAttribute('href', '/subject-requests');
  expect(within(todo).getByRole('link', { name: 'Seminer' })).toHaveAttribute(
    'href',
    '/events/e3/certificates',
  );
  expect(within(todo).getByText('3 sertifika basılamadı')).toBeInTheDocument();

  const week = screen.getByRole('region', { name: /^Bu hafta/ });
  expect(within(week).getByRole('link', { name: /Hackathon/ })).toHaveAttribute(
    'href',
    '/events/e1',
  );

  const chartsPart = await screen.findByTestId('charts');
  expect(chartsPart).toHaveTextContent('GECEKODU|true');

  const follows = (a: Element, b: Element) =>
    Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  expect(follows(todo, week) && follows(week, chartsPart)).toBe(true);
  expect(dashboardApi.summary).toHaveBeenCalledTimes(1);
});

it('gives a Member without a team role the week without links, and the club charts', async () => {
  signIn(['/UYELER/ARGE/WEBLAB']);
  (dashboardApi.summary as jest.Mock).mockResolvedValue({
    ...base,
    home: {
      ...charts,
      todo: null,
      week: { from: '', to: '', events: [], sessions: [] },
      compare: null,
    },
  } satisfies DashboardSummary);
  render(<DashboardPage />);

  expect(await screen.findByText('Bu hafta etkinlik yok')).toBeInTheDocument();
  expect(screen.getByTestId('charts')).toHaveTextContent('|false');
  expect(screen.queryByRole('link', { name: 'Takvim' })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: /^Yapılacaklar/ })).not.toBeInTheDocument();
});

it('says when nothing waits on the reader', async () => {
  signIn(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
  (dashboardApi.summary as jest.Mock).mockResolvedValue({
    ...base,
    home: {
      ...charts,
      todo: { drafts: [], incomplete: [], failedCertificates: [], subjectRequests: null },
      week: { from: '', to: '', events: [], sessions: [] },
      compare: null,
    },
  } satisfies DashboardSummary);
  render(<DashboardPage />);
  // One line in place of the card; the week takes the row
  expect(await screen.findByText('Bekleyen iş yok')).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: /^Yapılacaklar/ })).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: /^Bu hafta/ })).toBeInTheDocument();
});

it('sends door staff, whom the menu shows no Özet, to their doors', async () => {
  signIn(['/UYELER/ARGE/WEBLAB']);
  (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([{ id: 'e1', name: 'Hackathon' }]);
  (dashboardApi.summary as jest.Mock).mockResolvedValue({
    ...base,
    home: {
      ...charts,
      todo: null,
      week: { from: '', to: '', events: [], sessions: [] },
      compare: null,
    },
  } satisfies DashboardSummary);
  render(<DashboardPage />);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/qr'));
});

it('keeps a Member with no door on the page, and asks nothing of a reader with Özet', async () => {
  signIn(['/UYELER/ARGE/WEBLAB']);
  (dashboardApi.summary as jest.Mock).mockResolvedValue({
    ...base,
    home: {
      ...charts,
      todo: null,
      week: { from: '', to: '', events: [], sessions: [] },
      compare: null,
    },
  } satisfies DashboardSummary);
  render(<DashboardPage />);
  expect(await screen.findByText('Bu hafta etkinlik yok')).toBeInTheDocument();
  expect(mockReplace).not.toHaveBeenCalled();
});

it('does not read the doors of a reader whose menu has Özet', async () => {
  signIn(['/YK']);
  (dashboardApi.summary as jest.Mock).mockResolvedValue({
    ...base,
    home: {
      ...charts,
      todo: null,
      week: { from: '', to: '', events: [], sessions: [] },
      compare: null,
    },
  } satisfies DashboardSummary);
  render(<DashboardPage />);
  await screen.findByText('Bu hafta etkinlik yok');
  expect(ticketsApi.listDoorEvents).not.toHaveBeenCalled();
});

it('shows core’s problem when the summary cannot be read', async () => {
  signIn(['/YK']);
  (dashboardApi.summary as jest.Mock).mockRejectedValue(
    new ProblemError(500, 'Internal Server Error'),
  );
  render(<DashboardPage />);
  expect(await screen.findByText('Özet yüklenemedi')).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: /^Bu hafta/ })).not.toBeInTheDocument();
});
