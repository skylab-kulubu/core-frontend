import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import TicketDetailPage from '@/app/(authorized)/events/[id]/tickets/[ticketId]/page';
import { identityApi } from '@/lib/api/identity';
import { ticketsApi } from '@/lib/api/tickets';
import { eventDaysApi } from '@/lib/api/eventDays';

const mockAuth = { user: { id: 'yk', groups: ['/UYELER/YK'], roles: [] }, loading: false };
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/lib/api/events', () => ({
  eventsApi: {
    get: jest.fn().mockResolvedValue({ id: 'e1', name: 'GeceKodu', ownerTeam: 'GECEKODU' }),
  },
}));
jest.mock('@/lib/api/eventDays', () => ({
  eventDaysApi: { listByEvent: jest.fn(), listSessions: jest.fn() },
}));
jest.mock('@/lib/api/tickets', () => ({
  ticketsApi: {
    get: jest.fn(),
    listByEvent: jest.fn(),
    checkIn: jest.fn(),
    undoCheckIn: jest.fn(),
    resend: jest.fn(),
    renewLink: jest.fn(),
  },
}));
// core's capabilities cannot be read: the group rule decides (YK may do everything)
jest.mock('@/lib/api/capabilities', () => ({
  capabilitiesApi: { get: jest.fn().mockRejectedValue(new Error('down')) },
}));
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
  beforeEach(() => {
    jest.clearAllMocks();
    (eventDaysApi.listByEvent as jest.Mock).mockResolvedValue([]);
  });

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

  it('offers Katıldı, the ticket mail and a new link as commands, and the person card', async () => {
    (eventDaysApi.listByEvent as jest.Mock).mockResolvedValue([{ id: 'd1', eventId: 'e1' }]);
    (eventDaysApi.listSessions as jest.Mock).mockResolvedValue([
      { id: 's1', eventDayId: 'd1', title: 'Açılış' },
    ]);
    (ticketsApi.get as jest.Mock).mockResolvedValue({
      ...registered,
      owner: { id: 'u-ada', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' },
    });
    (ticketsApi.checkIn as jest.Mock).mockResolvedValue({
      id: 'c1',
      ticketId: 't1',
      sessionId: 's1',
      eventDayId: 'd1',
      createdAt: '2026-09-19T09:00:00.000Z',
    });
    const user = userEvent.setup();
    await renderTicket();
    const commands = await screen.findByRole('group', { name: 'Kayıt komutları' });
    expect(
      within(commands).getByRole('button', { name: 'Bileti yeniden gönder' }),
    ).toBeInTheDocument();
    expect(within(commands).getByRole('button', { name: 'Bağlantıyı yenile' })).toBeInTheDocument();
    await user.click(within(commands).getByRole('button', { name: 'Katıldı' }));
    expect(ticketsApi.checkIn).toHaveBeenCalledWith('t1', 's1');
  });

  it('takes an entry back from the entries card', async () => {
    (eventDaysApi.listByEvent as jest.Mock).mockResolvedValue([{ id: 'd1', eventId: 'e1' }]);
    (eventDaysApi.listSessions as jest.Mock).mockResolvedValue([
      { id: 's1', eventDayId: 'd1', title: 'Açılış' },
    ]);
    (ticketsApi.get as jest.Mock).mockResolvedValue({
      ...registered,
      owner: { id: 'u-ada', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' },
      checkIns: [
        {
          id: 'c1',
          ticketId: 't1',
          sessionId: 's1',
          eventDayId: 'd1',
          createdAt: '2026-09-19T09:00:00.000Z',
        },
      ],
    });
    (ticketsApi.undoCheckIn as jest.Mock).mockResolvedValue(undefined);
    const user = userEvent.setup();
    await renderTicket();
    await user.click(await screen.findByRole('button', { name: 'Açılış: girişi geri al' }));
    await waitFor(() => expect(ticketsApi.undoCheckIn).toHaveBeenCalledWith('s1', 'c1'));
  });
});
