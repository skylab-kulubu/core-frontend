import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import QrPage from '@/app/(authorized)/qr/page';
import { eventDaysApi } from '@/lib/api/eventDays';
import { eventsApi } from '@/lib/api/events';
import { identityApi } from '@/lib/api/identity';
import { ticketsApi } from '@/lib/api/tickets';

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'op',
      username: 'yk',
      email: 'yk@example.com',
      firstName: 'Y',
      lastName: 'K',
      roles: [],
      groups: ['/UYELER/YK'],
    },
  }),
}));

jest.mock('@/lib/api/events', () => ({
  eventsApi: { list: jest.fn() },
}));

jest.mock('@/lib/api/eventDays', () => ({
  eventDaysApi: { listByEvent: jest.fn(), listSessions: jest.fn() },
}));

jest.mock('@/lib/api/tickets', () => ({
  ticketsApi: { listByEvent: jest.fn(), checkIn: jest.fn() },
}));

jest.mock('@/lib/api/identity', () => ({
  identityApi: { listUsers: jest.fn(), getUser: jest.fn() },
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

const guestTicket = {
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

describe('Kapı check-in page', () => {
  beforeEach(() => {
    (eventsApi.list as jest.Mock).mockResolvedValue([event]);
    (eventDaysApi.listByEvent as jest.Mock).mockResolvedValue([
      { id: 'd1', eventId: 'e1', name: 'Gün 1' },
    ]);
    (eventDaysApi.listSessions as jest.Mock).mockResolvedValue([session]);
    (ticketsApi.listByEvent as jest.Mock).mockResolvedValue([guestTicket]);
    (identityApi.listUsers as jest.Mock).mockResolvedValue([]);
    (ticketsApi.checkIn as jest.Mock).mockResolvedValue({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      ticketId: 't-guest',
      sessionId: 's1',
      eventDayId: 'd1',
      createdAt: new Date(2026, 8, 19, 9, 4, 0).toISOString(),
    });
  });

  it('checks in by person or email and labels success as name · session · time', async () => {
    const user = userEvent.setup();
    render(<QrPage />);
    await waitFor(() => expect(screen.getByLabelText('E-posta')).toBeInTheDocument());
    expect(screen.queryByPlaceholderText('Bilet kimliği')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Bilet')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kişi seç' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('E-posta'), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Check-in' }));
    await waitFor(() => expect(ticketsApi.checkIn).toHaveBeenCalledWith('t-guest', 's1'));
    expect(screen.getByText(/Ada Lovelace · Açılış · /)).toBeInTheDocument();
    expect(screen.queryByText(/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/)).not.toBeInTheDocument();
  });

  it('accepts a typed name in the person field', async () => {
    const user = userEvent.setup();
    render(<QrPage />);
    await waitFor(() => expect(screen.getByPlaceholderText('Ad veya e-posta')).toBeInTheDocument());
    const field = screen.getByPlaceholderText('Ad veya e-posta') as HTMLInputElement;
    expect(field).toHaveAttribute('type', 'text');
    await user.type(field, 'Ada Lovelace');
    expect(field.checkValidity()).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Check-in' }));
    await waitFor(() => expect(ticketsApi.checkIn).toHaveBeenCalledWith('t-guest', 's1'));
  });
});
