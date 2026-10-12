import { screen } from '@testing-library/react';
import React from 'react';
import EventCompetitionPage from '@/app/(authorized)/events/[id]/(workspace)/competition/page';
import { competitorsApi } from '@/lib/api/competitors';
import { identityApi } from '@/lib/api/identity';
import { ticketsApi } from '@/lib/api/tickets';
import { primeEventWorkspace, renderEventTab, signInAs } from '@/test/event-workspace';

jest.mock('next/navigation', () => jest.requireActual('@/test/event-workspace').navigationModule);
jest.mock('@/context/AuthContext', () => jest.requireActual('@/test/event-workspace').authModule);
jest.mock('@/lib/api/events', () => jest.requireActual('@/test/event-workspace').eventsModule);
jest.mock(
  '@/lib/api/eventDays',
  () => jest.requireActual('@/test/event-workspace').eventDaysModule,
);
jest.mock('@/lib/api/sessions', () =>
  jest.requireActual('@/test/event-workspace').sessionsModule(),
);
jest.mock('@/lib/api/tickets', () => jest.requireActual('@/test/event-workspace').ticketsModule);
jest.mock('@/lib/api/identity', () => jest.requireActual('@/test/event-workspace').identityModule);
jest.mock(
  '@/lib/api/competitors',
  () => jest.requireActual('@/test/event-workspace').competitorsModule,
);
jest.mock('@/lib/api/teams', () => jest.requireActual('@/test/event-workspace').teamsModule);
jest.mock('@/lib/api/seasons', () => jest.requireActual('@/test/event-workspace').seasonsModule);
jest.mock('@/lib/scheduling/save-event', () =>
  jest.requireActual('@/test/event-workspace').saveEventModule(),
);

const competitor = (id: string, userId: string) => ({
  id,
  userId,
  eventId: 'e1',
  score: 10,
  isWinner: false,
  createdAt: '',
  updatedAt: '',
});

describe('Event Yarışma tab', () => {
  beforeEach(primeEventWorkspace);

  it('names competitors from tickets and by id, never from the whole directory', async () => {
    signInAs(['/UYELER/YK']);
    (competitorsApi.listByEvent as jest.Mock).mockResolvedValue([
      competitor('c1', 'u-ticket'),
      competitor('c2', 'u-other'),
    ]);
    (ticketsApi.listByEvent as jest.Mock).mockResolvedValue([
      {
        id: 't1',
        eventId: 'e1',
        ticketType: 'REGISTERED',
        ownerId: 'u-ticket',
        owner: { id: 'u-ticket', email: 'ada@example.com', firstName: 'Ada', lastName: 'L' },
        checkIns: [],
        createdAt: '',
        updatedAt: '',
      },
    ]);
    (identityApi.getUser as jest.Mock).mockResolvedValue({
      id: 'u-other',
      email: 'bo@example.com',
      firstName: 'Bo',
      lastName: 'K',
    });

    await renderEventTab(<EventCompetitionPage />, '/events/e1/competition');

    expect(await screen.findByRole('link', { name: /Bo K/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ada L/ })).toBeInTheDocument();
    expect(identityApi.getUser).toHaveBeenCalledTimes(1);
    expect(identityApi.getUser).toHaveBeenCalledWith('u-other');
    expect(identityApi.listUsers).not.toHaveBeenCalled();
  });
});
