import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import QrPage from '@/app/(authorized)/qr/page';
import { eventDaysApi } from '@/lib/api/eventDays';
import { eventsApi } from '@/lib/api/events';
import { ticketsApi } from '@/lib/api/tickets';

let mockAuthUser = {
  id: 'op',
  username: 'yk',
  email: 'yk@example.com',
  firstName: 'Y',
  lastName: 'K',
  roles: [] as string[],
  groups: ['/UYELER/YK'],
};

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockAuthUser,
  }),
}));

jest.mock('@/lib/api/events', () => ({
  eventsApi: { list: jest.fn() },
}));

jest.mock('@/lib/api/eventDays', () => ({
  eventDaysApi: { listByEvent: jest.fn(), listSessions: jest.fn() },
}));

jest.mock('@/lib/api/tickets', () => ({
  ticketsApi: {
    listDoorEvents: jest.fn(),
    searchDoorAttendees: jest.fn(),
    resolveAndCheckIn: jest.fn(),
    doorActivity: jest.fn(),
  },
}));

const event = {
  id: 'e1',
  name: 'SkyDays',
  description: '',
  location: '',
  ownerTeam: 'WEBLAB',
  capacity: 10,
  active: true,
  ranked: false,
  createdAt: '',
  updatedAt: '',
};

const session = {
  id: 's1',
  eventDayId: 'd1',
  title: 'Açılış',
  speakerName: 'Ada',
  orderIndex: 0,
  sessionType: 'KEYNOTE',
};

describe('Kapı check-in page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser = {
      id: 'op',
      username: 'yk',
      email: 'yk@example.com',
      firstName: 'Y',
      lastName: 'K',
      roles: [],
      groups: ['/UYELER/YK'],
    };
    (eventsApi.list as jest.Mock).mockResolvedValue([event]);
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([event]);
    (eventDaysApi.listByEvent as jest.Mock).mockResolvedValue([
      { id: 'd1', eventId: 'e1', name: 'Gün 1' },
    ]);
    (eventDaysApi.listSessions as jest.Mock).mockResolvedValue([session]);
    (ticketsApi.searchDoorAttendees as jest.Mock).mockResolvedValue([]);
    (ticketsApi.doorActivity as jest.Mock).mockResolvedValue({ total: 0, items: [] });
    (ticketsApi.resolveAndCheckIn as jest.Mock).mockResolvedValue({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      sessionId: 's1',
      eventDayId: 'd1',
      personName: 'Ada Lovelace',
      createdAt: new Date(2026, 8, 19, 9, 4, 0).toISOString(),
    });
  });

  it('checks in by person or email and labels success as name · session · time', async () => {
    const user = userEvent.setup();
    render(<QrPage />);
    await waitFor(() => expect(screen.getByLabelText('Ad veya e-posta')).toBeInTheDocument());
    expect(screen.queryByPlaceholderText('Bilet kimliği')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Bilet')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Katılımcı bul' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Ad veya e-posta'), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Check-in' }));
    await waitFor(() =>
      expect(ticketsApi.resolveAndCheckIn).toHaveBeenCalledWith('s1', {
        personId: undefined,
        query: 'ada@example.com',
      }),
    );
    expect(screen.getByRole('status', { name: 'Check-in sonucu' })).toHaveTextContent(
      /Ada Lovelace · Açılış · /,
    );
    expect(screen.queryByText(/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/)).not.toBeInTheDocument();
  });

  it('accepts a typed name in the person field', async () => {
    const user = userEvent.setup();
    render(<QrPage />);
    await waitFor(() => expect(screen.getByLabelText('Ad veya e-posta')).toBeInTheDocument());
    const field = screen.getByLabelText('Ad veya e-posta') as HTMLInputElement;
    expect(field).toHaveAttribute('type', 'text');
    expect(field).toHaveAttribute('placeholder', 'Ad veya e-posta');
    await user.type(field, 'Ada Lovelace');
    expect(field.checkValidity()).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Check-in' }));
    await waitFor(() =>
      expect(ticketsApi.resolveAndCheckIn).toHaveBeenCalledWith('s1', {
        personId: undefined,
        query: 'Ada Lovelace',
      }),
    );
  });

  it('requires a person or email before attempting check-in', async () => {
    const user = userEvent.setup();
    render(<QrPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check-in' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Check-in' }));
    expect(ticketsApi.resolveAndCheckIn).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Kişi veya e-posta girin');
  });

  it('offers an assigned event to door staff without a leader group', async () => {
    mockAuthUser = {
      id: 'door-1',
      username: 'door',
      email: 'door@example.com',
      firstName: 'Door',
      lastName: 'Staff',
      roles: [],
      groups: ['/UYELER/ARGE/WEBLAB'],
    };
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([event]);

    render(<QrPage />);

    expect(await screen.findByRole('option', { name: 'SkyDays' })).toBeInTheDocument();
    expect(screen.queryByText('Kapı için etkinlik yok')).not.toBeInTheDocument();
    expect(eventsApi.list).not.toHaveBeenCalled();
  });

  it('announces event loading failures instead of showing an empty authorization state', async () => {
    (ticketsApi.listDoorEvents as jest.Mock).mockRejectedValue(new Error('offline'));
    render(<QrPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Etkinlikler yüklenemedi');
    expect(screen.queryByText('Kapı için etkinlik yok')).not.toBeInTheDocument();
  });

  it('lets door staff find and select a guest through the safe attendee projection', async () => {
    const user = userEvent.setup();
    mockAuthUser = {
      id: 'door-1',
      username: 'door',
      email: 'door@example.com',
      firstName: 'Door',
      lastName: 'Staff',
      roles: [],
      groups: ['/UYELER/ARGE/WEBLAB'],
    };
    (ticketsApi.searchDoorAttendees as jest.Mock).mockResolvedValue([
      { name: 'Ada Lovelace', email: 'ada@example.com' },
    ]);

    render(<QrPage />);
    await user.click(await screen.findByRole('button', { name: 'Katılımcı bul' }));
    const dialog = screen.getByRole('dialog', { name: 'Katılımcı bul' });
    await user.type(within(dialog).getByPlaceholderText('Ad veya e-posta'), 'ada');
    await user.click(await within(dialog).findByRole('button', { name: /Ada Lovelace/ }));
    await user.click(screen.getByRole('button', { name: 'Check-in' }));

    await waitFor(() =>
      expect(ticketsApi.resolveAndCheckIn).toHaveBeenCalledWith('s1', {
        personId: undefined,
        query: 'ada@example.com',
      }),
    );
  });

  it('clears a selected attendee when the event changes', async () => {
    const user = userEvent.setup();
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([
      event,
      { ...event, id: 'e2', name: 'SkySec' },
    ]);
    (ticketsApi.searchDoorAttendees as jest.Mock).mockResolvedValue([
      { name: 'Ada Lovelace', email: 'ada@example.com' },
    ]);
    (eventDaysApi.listByEvent as jest.Mock).mockImplementation((eventId: string) =>
      eventId === 'e2'
        ? new Promise(() => undefined)
        : Promise.resolve([{ id: 'd1', eventId: 'e1', name: 'Gün 1' }]),
    );

    render(<QrPage />);
    await user.click(await screen.findByRole('button', { name: 'Katılımcı bul' }));
    const dialog = screen.getByRole('dialog', { name: 'Katılımcı bul' });
    await user.type(within(dialog).getByPlaceholderText('Ad veya e-posta'), 'ada');
    await user.click(await within(dialog).findByRole('button', { name: /Ada Lovelace/ }));
    expect(screen.getByRole('button', { name: 'Katılımcı bul' })).toHaveTextContent('Ada Lovelace');

    await user.selectOptions(screen.getByLabelText('Etkinlik'), 'e2');

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Katılımcı bul' })).toHaveTextContent(
        'Katılımcı bul',
      ),
    );
    expect(screen.getByLabelText('Ad veya e-posta')).toHaveValue('');
    expect(screen.getByLabelText('Oturum')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Check-in' }));
    expect(ticketsApi.resolveAndCheckIn).not.toHaveBeenCalled();
  });

  it('uses manual input instead of a stale selected person', async () => {
    const user = userEvent.setup();
    (ticketsApi.searchDoorAttendees as jest.Mock).mockResolvedValue([
      { personId: 'u-ada', name: 'Ada Lovelace', email: 'ada@example.com' },
    ]);

    render(<QrPage />);
    await user.click(await screen.findByRole('button', { name: 'Katılımcı bul' }));
    const dialog = screen.getByRole('dialog', { name: 'Katılımcı bul' });
    await user.type(within(dialog).getByPlaceholderText('Ad veya e-posta'), 'ada');
    await user.click(await within(dialog).findByRole('button', { name: /Ada Lovelace/ }));
    await user.type(screen.getByLabelText('Ad veya e-posta'), 'Grace Hopper');
    await user.click(screen.getByRole('button', { name: 'Check-in' }));

    await waitFor(() =>
      expect(ticketsApi.resolveAndCheckIn).toHaveBeenCalledWith('s1', {
        personId: undefined,
        query: 'Grace Hopper',
      }),
    );
  });

  it('shows the server-backed live count and recent check-ins', async () => {
    (ticketsApi.doorActivity as jest.Mock).mockResolvedValue({
      total: 12,
      items: [
        {
          id: 'ci-1',
          sessionId: 's1',
          eventDayId: 'd1',
          personName: 'Grace Hopper',
          createdAt: '2026-09-19T08:05:00.000Z',
        },
      ],
    });

    render(<QrPage />);

    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Canlı check-in sayısı' })).toHaveTextContent('12'),
    );
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
  });

  it('clears a transient live-activity error after the next successful refresh', async () => {
    let refresh: (() => void) | undefined;
    const interval = jest.spyOn(window, 'setInterval').mockImplementation((handler) => {
      refresh = handler as () => void;
      return {} as ReturnType<typeof setInterval>;
    });
    (ticketsApi.doorActivity as jest.Mock)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ total: 1, items: [] });
    render(<QrPage />);
    expect(await screen.findByText('Canlı kapı kayıtları yüklenemedi')).toBeInTheDocument();

    await act(async () => refresh?.());
    await waitFor(() =>
      expect(screen.queryByText('Canlı kapı kayıtları yüklenemedi')).not.toBeInTheDocument(),
    );
    interval.mockRestore();
  });
});
