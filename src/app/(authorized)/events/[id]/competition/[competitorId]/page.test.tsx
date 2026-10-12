import { act, render, screen } from '@testing-library/react';
import React from 'react';
import EditCompetitorPage from '@/app/(authorized)/events/[id]/competition/[competitorId]/page';
import { competitorsApi } from '@/lib/api/competitors';
import { eventsApi } from '@/lib/api/events';

const mockRouter = { push: jest.fn(), replace: jest.fn() };
const mockAuth = { user: { id: 'yk', groups: ['/UYELER/YK'], roles: [] } };

jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/lib/api/events', () => ({ eventsApi: { get: jest.fn() } }));
jest.mock('@/lib/api/competitors', () => ({ competitorsApi: { get: jest.fn() } }));
jest.mock('@/lib/api/identity', () => ({
  identityApi: { listUsers: jest.fn(), getUser: jest.fn().mockResolvedValue(undefined) },
}));

const competitor = {
  id: 'c1',
  userId: 'u1',
  eventId: 'e2',
  score: 5,
  isWinner: false,
  createdAt: '',
  updatedAt: '',
};

async function renderEdit(eventId: string) {
  await act(async () => {
    render(<EditCompetitorPage params={Promise.resolve({ id: eventId, competitorId: 'c1' })} />);
  });
}

describe('Event Yarışma: edit competitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (competitorsApi.get as jest.Mock).mockResolvedValue(competitor);
    (eventsApi.get as jest.Mock).mockResolvedValue({
      id: 'e2',
      name: 'Hackathon',
      ownerTeam: 'GECEKODU',
    });
  });

  it('opens the competitor under its own event when the address names another', async () => {
    await renderEdit('e1');
    expect(mockRouter.replace).toHaveBeenCalledWith('/events/e2/competition/c1');
    expect(eventsApi.get).not.toHaveBeenCalled();
  });

  it('shows the competitor of the event in the address', async () => {
    await renderEdit('e2');
    expect(await screen.findByText('Hackathon')).toBeInTheDocument();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
