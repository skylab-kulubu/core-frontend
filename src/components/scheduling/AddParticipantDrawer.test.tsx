import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AddParticipantDrawer } from '@/components/scheduling/AddParticipantDrawer';
import { ticketsApi } from '@/lib/api/tickets';

jest.mock('@/lib/api/tickets', () => ({
  ticketsApi: {
    applyForOther: jest.fn(),
    applyGuest: jest.fn(),
    listAssignableUsers: jest.fn(),
  },
}));

jest.mock('@/lib/api/identity', () => ({
  identityApi: { listUsers: jest.fn(), getUser: jest.fn() },
}));

describe('AddParticipantDrawer guest apply', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ticketsApi.listAssignableUsers as jest.Mock).mockResolvedValue([]);
    (ticketsApi.applyGuest as jest.Mock).mockResolvedValue({
      id: 't-guest',
      eventId: 'e1',
      ticketType: 'GUEST',
      guestEmail: 'ada@example.com',
      checkIns: [],
    });
  });

  it('searches the event-scoped assignable directory for leaders', async () => {
    const user = userEvent.setup();
    render(<AddParticipantDrawer open onClose={jest.fn()} eventId="e1" onCreated={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Kişi seç' }));
    const search = screen.getByPlaceholderText('Ad, e-posta');
    await user.type(search, 'Ada');
    await waitFor(() => expect(ticketsApi.listAssignableUsers).toHaveBeenCalledWith('e1', 'Ada'));
    expect((await import('@/lib/api/identity')).identityApi.listUsers).not.toHaveBeenCalled();
  });

  it('submits guest apply without a phone', async () => {
    const user = userEvent.setup();
    const onCreated = jest.fn();
    render(<AddParticipantDrawer open onClose={jest.fn()} eventId="e1" onCreated={onCreated} />);
    const phone = screen.getByLabelText('Telefon') as HTMLInputElement;
    expect(phone).not.toBeRequired();
    await user.type(screen.getByLabelText('Ad'), 'Ada');
    await user.type(screen.getByLabelText('Soyad'), 'Lovelace');
    await user.type(screen.getByLabelText('E-posta'), 'ada@example.com');
    expect(phone.checkValidity()).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Misafir kaydı yaz' }));
    await waitFor(() =>
      expect(ticketsApi.applyGuest).toHaveBeenCalledWith('e1', {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
      }),
    );
    expect((ticketsApi.applyGuest as jest.Mock).mock.calls[0][1]).not.toHaveProperty('phoneNumber');
  });

  it('rejects whitespace-only guest names before calling the API', async () => {
    const user = userEvent.setup();
    render(<AddParticipantDrawer open onClose={jest.fn()} eventId="e1" onCreated={jest.fn()} />);
    await user.type(screen.getByLabelText('Ad'), '   ');
    await user.type(screen.getByLabelText('Soyad'), 'Lovelace');
    await user.type(screen.getByLabelText('E-posta'), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Misafir kaydı yaz' }));
    expect(ticketsApi.applyGuest).not.toHaveBeenCalled();
    expect(screen.getByText('Ad zorunlu')).toBeInTheDocument();
  });

  it('locks both submission paths while a participant request is pending', async () => {
    const user = userEvent.setup();
    (ticketsApi.listAssignableUsers as jest.Mock).mockResolvedValue([
      {
        id: 'u1',
        email: 'ada@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
      },
    ]);
    (ticketsApi.applyForOther as jest.Mock).mockImplementation(() => new Promise(() => undefined));
    render(<AddParticipantDrawer open onClose={jest.fn()} eventId="e1" onCreated={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Kişi seç' }));
    await user.click(await screen.findByRole('button', { name: 'Ada Lovelace' }));
    await user.click(screen.getByRole('button', { name: 'Üye kaydı yaz' }));
    await waitFor(() => expect(ticketsApi.applyForOther).toHaveBeenCalledWith('e1', 'u1'));
    expect(screen.getByRole('button', { name: 'Misafir kaydı yaz' })).toBeDisabled();
  });
});
