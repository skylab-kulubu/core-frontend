import { render, screen, within } from '@testing-library/react';
import React from 'react';
import DashboardPage from '@/app/(authorized)/dashboard/page';
import { useAuth } from '@/context/AuthContext';
import { dashboardApi, type DashboardSummary } from '@/lib/api/dashboard';
import { ProblemError } from '@/lib/api/core';

jest.mock('@/context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/api/dashboard', () => ({ dashboardApi: { summary: jest.fn() } }));

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
  jest.useFakeTimers({
    now: new Date('2026-11-22T12:00:00Z'),
    doNotFake: ['setTimeout', 'queueMicrotask', 'nextTick'],
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

it('asks core once and shows the to-dos first, then the week, then the figures', async () => {
  signIn(['/YK']);
  (dashboardApi.summary as jest.Mock).mockResolvedValue({
    ...base,
    home: {
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
  const todo = screen.getByRole('region', { name: 'Yapılacaklar' });
  expect(
    within(todo).getByRole('link', { name: /1 KVKK başvurusu yanıt bekliyor/ }),
  ).toHaveAttribute('href', '/subject-requests');
  expect(
    within(todo).getByRole('link', { name: /Seminer: 3 sertifika basılamadı/ }),
  ).toHaveAttribute('href', '/events/e3/certificates');

  const week = screen.getByRole('region', { name: 'Bu hafta' });
  expect(within(week).getByRole('link', { name: /Hackathon/ })).toHaveAttribute(
    'href',
    '/events/e1',
  );

  const numbers = screen.getByRole('region', { name: 'Son 30 gün' });
  expect(
    within(numbers).getByRole('link', { name: /Başvuru 40 Önceki: 25 · \+%60/ }),
  ).toBeInTheDocument();
  expect(within(numbers).getByRole('link', { name: /Yeni üye/ })).toBeInTheDocument();

  const follows = (a: Element, b: Element) =>
    Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  expect(follows(todo, week) && follows(week, numbers)).toBe(true);
  expect(dashboardApi.summary).toHaveBeenCalledTimes(1);
});

it('gives a Member without a team role only the week, with a plain empty state', async () => {
  signIn(['/UYELER/ARGE/WEBLAB']);
  (dashboardApi.summary as jest.Mock).mockResolvedValue({
    ...base,
    home: { todo: null, week: { from: '', to: '', events: [], sessions: [] }, compare: null },
  } satisfies DashboardSummary);
  render(<DashboardPage />);

  expect(await screen.findByText('Bu hafta etkinlik yok')).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Yapılacaklar' })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: /Son 30 gün/ })).not.toBeInTheDocument();
});

it('says when nothing waits on the reader', async () => {
  signIn(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
  (dashboardApi.summary as jest.Mock).mockResolvedValue({
    ...base,
    home: {
      todo: { drafts: [], incomplete: [], failedCertificates: [], subjectRequests: null },
      week: { from: '', to: '', events: [], sessions: [] },
      compare: null,
    },
  } satisfies DashboardSummary);
  render(<DashboardPage />);
  expect(await screen.findByText('Bekleyen iş yok')).toBeInTheDocument();
});

it('shows core’s problem when the summary cannot be read', async () => {
  signIn(['/YK']);
  (dashboardApi.summary as jest.Mock).mockRejectedValue(
    new ProblemError(500, 'Internal Server Error'),
  );
  render(<DashboardPage />);
  expect(await screen.findByText('Özet yüklenemedi')).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Bu hafta' })).not.toBeInTheDocument();
});
