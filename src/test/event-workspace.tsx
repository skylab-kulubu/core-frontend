// Mocks and fixtures for the /events/[id] workspace's tests. Each test file
// points jest.mock at these (this module imports no app code, so a mock factory
// can require it), primes them in beforeEach, and renders a tab in the layout:
//
//   jest.mock('@/lib/api/events', () => jest.requireActual('@/test/event-workspace').eventsModule);
//   beforeEach(primeEventWorkspace);
//   await renderEventTab(<EventProgramPage />, '/events/e1/program');
import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { UserDto } from '@/types/api';

export const workspaceRouter = { push: jest.fn(), replace: jest.fn() };
const openPath = { pathname: '/events/e1' };

export const navigationModule = {
  useRouter: () => workspaceRouter,
  usePathname: () => openPath.pathname,
};
export const authModule = { useAuth: jest.fn() };
export const eventsModule = {
  eventsApi: { get: jest.fn(), delete: jest.fn(), list: jest.fn(), syncMailList: jest.fn() },
};
export const eventDaysModule = {
  eventDaysApi: {
    listByEvent: jest.fn(),
    listSessions: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
};
export function sessionsModule() {
  return {
    ...jest.requireActual('@/lib/api/sessions'),
    sessionsApi: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  };
}
export const ticketsModule = {
  ticketsApi: {
    listByEvent: jest.fn(),
    listDoorEvents: jest.fn(),
    searchDoorAttendees: jest.fn(),
    resolveAndCheckIn: jest.fn(),
    checkIn: jest.fn(),
  },
};
export const identityModule = { identityApi: { listUsers: jest.fn(), getUser: jest.fn() } };
export const competitorsModule = { competitorsApi: { listByEvent: jest.fn() } };
export const teamsModule = { teamsApi: { list: jest.fn() } };
export const seasonsModule = { seasonsApi: { list: jest.fn() } };
export function saveEventModule() {
  return {
    ...jest.requireActual('@/lib/scheduling/save-event'),
    saveEventWithSeason: jest.fn(),
  };
}

export const workspaceEvent = {
  id: 'e1',
  name: 'GeceKodu',
  description: '',
  location: 'YTÜ',
  ownerTeam: 'GECEKODU',
  capacity: 10,
  active: true,
  ranked: false,
  createdAt: '',
  updatedAt: '',
};

export const workspaceSession = {
  id: 's1',
  eventDayId: 'd1',
  title: 'Açılış',
  speakerName: 'Ada',
  orderIndex: 0,
  sessionType: 'KEYNOTE',
};

export const guestTicket = {
  id: 't-guest',
  eventId: 'e1',
  ticketType: 'GUEST' as const,
  guestFirstName: 'Ada',
  guestLastName: 'Lovelace',
  guestEmail: 'ada@example.com',
  checkIns: [],
  createdAt: '2026-09-19T08:05:00.000Z',
  updatedAt: '2026-09-19T08:05:00.000Z',
};

export function authUser(groups: string[]): UserDto {
  return {
    id: 'u1',
    username: 'op',
    email: 'op@example.com',
    firstName: 'O',
    lastName: 'P',
    roles: [],
    groups,
  };
}

export function signInAs(groups: string[]) {
  authModule.useAuth.mockReturnValue({ user: authUser(groups) });
}

/** One day with one session, no tickets, no door duty: the event most tests start from. */
export function primeEventWorkspace() {
  jest.clearAllMocks();
  eventsModule.eventsApi.get.mockResolvedValue(workspaceEvent);
  eventsModule.eventsApi.list.mockResolvedValue([]);
  eventDaysModule.eventDaysApi.listByEvent.mockResolvedValue([
    { id: 'd1', eventId: 'e1', name: 'Gün 1' },
  ]);
  eventDaysModule.eventDaysApi.listSessions.mockResolvedValue([workspaceSession]);
  ticketsModule.ticketsApi.listByEvent.mockResolvedValue([]);
  ticketsModule.ticketsApi.listDoorEvents.mockResolvedValue([]);
  ticketsModule.ticketsApi.searchDoorAttendees.mockResolvedValue([]);
  identityModule.identityApi.listUsers.mockResolvedValue([]);
  competitorsModule.competitorsApi.listByEvent.mockResolvedValue([]);
  teamsModule.teamsApi.list.mockResolvedValue([]);
  seasonsModule.seasonsApi.list.mockResolvedValue([]);
}

/**
 * Renders a tab's page inside the real /events/[id] layout, as if `pathname` were
 * open. `openTab` then moves to another tab the way the router does: the same
 * layout stays mounted and only the page below it changes.
 */
export async function renderEventTab(page: ReactNode, pathname = '/events/e1') {
  const { default: EventWorkspaceLayout } =
    await import('@/app/(authorized)/events/[id]/(workspace)/layout');
  const inLayout = (children: ReactNode) =>
    EventWorkspaceLayout({ children, params: Promise.resolve({ id: 'e1' }) });
  openPath.pathname = pathname;
  const first = await inLayout(page);
  let view: ReturnType<typeof render> | undefined;
  await act(async () => {
    view = render(first);
  });
  return {
    async openTab(next: ReactNode, nextPathname: string) {
      openPath.pathname = nextPathname;
      const element = await inLayout(next);
      await act(async () => {
        view?.rerender(element);
      });
    },
  };
}
