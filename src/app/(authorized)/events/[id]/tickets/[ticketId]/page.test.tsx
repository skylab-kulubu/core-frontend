import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import TicketDetailPage from '@/app/(authorized)/events/[id]/tickets/[ticketId]/page';
import { identityApi } from '@/lib/api/identity';
import { ticketsApi } from '@/lib/api/tickets';
import { eventDaysApi } from '@/lib/api/eventDays';
import { UNDO_GRACE_MS } from '@/lib/ui/use-deferred-undo';

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
    cancel: jest.fn(),
    restore: jest.fn(),
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

  it('cancels the ticket with its reason, and shows it cancelled', async () => {
    const ada = {
      ...registered,
      status: 'active',
      owner: { id: 'u-ada', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' },
    };
    const gone = {
      ...ada,
      status: 'cancelled',
      cancelledAt: '2026-11-24T10:05:00.000Z',
      cancelledBy: 'operator',
      cancelReason: 'Çift kayıt',
    };
    (ticketsApi.get as jest.Mock).mockResolvedValueOnce(ada).mockResolvedValue(gone);
    (ticketsApi.cancel as jest.Mock).mockResolvedValue(gone);
    const user = userEvent.setup();
    await renderTicket();
    const commands = await screen.findByRole('group', { name: 'Kayıt komutları' });
    await user.click(within(commands).getByRole('button', { name: 'Bileti iptal et' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Ada Lovelace: bilet iptal edilsin mi?',
    });
    await user.type(within(dialog).getByLabelText('Gerekçe (isteğe bağlı)'), 'Çift kayıt');
    await user.click(within(dialog).getByRole('button', { name: 'Bileti iptal et' }));
    await waitFor(() => expect(ticketsApi.cancel).toHaveBeenCalledWith('t1', 'Çift kayıt'));

    await waitFor(() =>
      expect(within(commands).getByRole('button', { name: 'Geri al' })).toBeInTheDocument(),
    );
    expect(within(commands).queryByRole('button', { name: 'Bileti iptal et' })).toBeNull();
    expect(within(commands).queryByRole('button', { name: 'Bileti yeniden gönder' })).toBeNull();
    expect(within(commands).queryByRole('button', { name: 'Bağlantıyı yenile' })).toBeNull();
    expect(screen.getAllByText('Çift kayıt').length).toBeGreaterThan(0);
  });

  it('shuts cancel and Geri al once the event is over', async () => {
    const { eventsApi } = jest.requireMock('@/lib/api/events');
    const over = {
      id: 'e1',
      name: 'GeceKodu',
      ownerTeam: 'GECEKODU',
      startDate: '2026-01-10T09:00:00+03:00',
      endDate: '2026-01-10T18:00:00+03:00',
    };
    const ada = {
      ...registered,
      status: 'active',
      owner: { id: 'u-ada', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' },
    };
    (eventsApi.get as jest.Mock).mockResolvedValueOnce(over);
    (ticketsApi.get as jest.Mock).mockResolvedValue(ada);
    await renderTicket();
    let commands = await screen.findByRole('group', { name: 'Kayıt komutları' });
    const cancel = within(commands).getByRole('button', { name: 'Bileti iptal et' });
    expect(cancel).toBeDisabled();
    expect(cancel).toHaveAttribute('title', 'Etkinlik bitti');

    (eventsApi.get as jest.Mock).mockResolvedValueOnce(over);
    (ticketsApi.get as jest.Mock).mockResolvedValue({ ...ada, status: 'cancelled' });
    cleanup();
    await renderTicket();
    commands = await screen.findByRole('group', { name: 'Kayıt komutları' });
    const restore = within(commands).getByRole('button', { name: 'Geri al' });
    expect(restore).toBeDisabled();
    expect(restore).toHaveAttribute('title', 'Etkinlik bitti');
  });

  it('takes a cancellation back', async () => {
    const gone = {
      ...registered,
      status: 'cancelled',
      cancelledAt: '2026-11-24T10:05:00.000Z',
      owner: { id: 'u-ada', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' },
    };
    (ticketsApi.get as jest.Mock).mockResolvedValueOnce(gone).mockResolvedValue({
      ...gone,
      status: 'active',
      cancelledAt: undefined,
    });
    (ticketsApi.restore as jest.Mock).mockResolvedValue({ ...gone, status: 'active' });
    const user = userEvent.setup();
    await renderTicket();
    const commands = await screen.findByRole('group', { name: 'Kayıt komutları' });
    await user.click(within(commands).getByRole('button', { name: 'Geri al' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Ada Lovelace: iptal geri alınsın mı?',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Geri al' }));
    await waitFor(() => expect(ticketsApi.restore).toHaveBeenCalledWith('t1'));
    expect(
      await within(commands).findByRole('button', { name: 'Bileti iptal et' }),
    ).toBeInTheDocument();
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
    await renderTicket();
    const undo = await screen.findByRole('button', { name: 'Açılış: girişi geri al' });
    jest.useFakeTimers();
    try {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await user.click(undo);
      // Not at the first press: Vazgeç stands in its place for a few seconds
      expect(ticketsApi.undoCheckIn).not.toHaveBeenCalled();
      expect(
        screen.getByRole('button', { name: 'Açılış: geri almaktan vazgeç' }),
      ).toBeInTheDocument();
      await act(async () => {
        jest.advanceTimersByTime(UNDO_GRACE_MS);
      });
    } finally {
      jest.useRealTimers();
    }
    await waitFor(() => expect(ticketsApi.undoCheckIn).toHaveBeenCalledWith('s1', 'c1'));
  });
});
