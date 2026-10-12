import { act, render, screen } from '@testing-library/react';
import React from 'react';
import TicketDetailPage from '@/app/(authorized)/events/[id]/tickets/[ticketId]/page';
import { identityApi } from '@/lib/api/identity';
import { ticketsApi } from '@/lib/api/tickets';

const mockAuth = { user: { id: 'yk', groups: ['/UYELER/YK'], roles: [] }, loading: false };
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/lib/api/events', () => ({
  eventsApi: {
    get: jest.fn().mockResolvedValue({ id: 'e1', name: 'GeceKodu', ownerTeam: 'GECEKODU' }),
  },
}));
jest.mock('@/lib/api/eventDays', () => ({
  eventDaysApi: { listByEvent: jest.fn().mockResolvedValue([]), listSessions: jest.fn() },
}));
jest.mock('@/lib/api/tickets', () => ({ ticketsApi: { get: jest.fn(), listByEvent: jest.fn() } }));
jest.mock('@/lib/api/identity', () => ({
  identityApi: { listUsers: jest.fn(), getUser: jest.fn() },
}));

const registered = {
  id: 't1',
  eventId: 'e1',
  ticketType: 'REGISTERED',
  ownerId: 'u-ada',
  checkIns: [],
  createdAt: '2026-09-19T08:05:00.000Z',
  updatedAt: '2026-09-19T08:05:00.000Z',
};

async function renderTicket() {
  await act(async () => {
    render(<TicketDetailPage params={Promise.resolve({ id: 'e1', ticketId: 't1' })} />);
  });
}

describe('Ticket detail page', () => {
  beforeEach(() => jest.clearAllMocks());

  it('names the applicant from the ticket without reading the directory', async () => {
    (ticketsApi.get as jest.Mock).mockResolvedValue({
      ...registered,
      owner: { id: 'u-ada', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' },
    });
    await renderTicket();
    expect(await screen.findByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(identityApi.listUsers).not.toHaveBeenCalled();
    expect(identityApi.getUser).not.toHaveBeenCalled();
  });

  it('looks the owner up by id when the ticket has no owner summary', async () => {
    (ticketsApi.get as jest.Mock).mockResolvedValue(registered);
    (identityApi.getUser as jest.Mock).mockResolvedValue({
      id: 'u-ada',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    await renderTicket();
    expect(await screen.findByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(identityApi.getUser).toHaveBeenCalledWith('u-ada');
    expect(identityApi.listUsers).not.toHaveBeenCalled();
  });
});
