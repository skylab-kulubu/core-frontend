import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AddParticipantDrawer } from '@/components/scheduling/AddParticipantDrawer';
import { ticketsApi } from '@/lib/api/tickets';

jest.mock('@/lib/api/tickets', () => ({
  ticketsApi: {
    applyForOther: jest.fn(),
    applyGuest: jest.fn(),
  },
}));

jest.mock('@/lib/api/identity', () => ({
  identityApi: { listUsers: jest.fn(), getUser: jest.fn() },
}));

describe('AddParticipantDrawer guest apply', () => {
  beforeEach(() => {
    (ticketsApi.applyGuest as jest.Mock).mockResolvedValue({
      id: 't-guest',
      eventId: 'e1',
      ticketType: 'GUEST',
      guestEmail: 'ada@example.com',
      checkIns: [],
    });
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
});
