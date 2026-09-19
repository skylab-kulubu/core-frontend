import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { DoorAttendeePick } from '@/components/scheduling/DoorAttendeePick';
import { ticketsApi, type DoorAttendee } from '@/lib/api/tickets';

jest.mock('@/lib/api/tickets', () => ({
  ticketsApi: { searchDoorAttendees: jest.fn() },
}));

describe('DoorAttendeePick', () => {
  it('keeps the newest autocomplete response when requests finish out of order', async () => {
    const user = userEvent.setup();
    let resolveAda: (rows: DoorAttendee[]) => void = () => undefined;
    let resolveGrace: (rows: DoorAttendee[]) => void = () => undefined;
    (ticketsApi.searchDoorAttendees as jest.Mock).mockImplementation(
      (_eventId: string, query: string) =>
        new Promise<DoorAttendee[]>((resolve) => {
          if (query === 'ad') resolveAda = resolve;
          if (query === 'grace') resolveGrace = resolve;
        }),
    );
    render(<DoorAttendeePick eventId="e1" valueKey="" onPick={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Katılımcı bul' }));
    const dialog = screen.getByRole('dialog', { name: 'Katılımcı bul' });
    const field = within(dialog).getByPlaceholderText('Ad veya e-posta');
    await user.type(field, 'ad');
    await waitFor(() => expect(ticketsApi.searchDoorAttendees).toHaveBeenCalledWith('e1', 'ad'));
    await user.clear(field);
    await user.type(field, 'grace');
    await waitFor(() => expect(ticketsApi.searchDoorAttendees).toHaveBeenCalledWith('e1', 'grace'));

    await act(async () => resolveGrace([{ name: 'Grace Hopper', email: 'grace@example.com' }]));
    expect(await within(dialog).findByRole('button', { name: /Grace Hopper/ })).toBeInTheDocument();
    await act(async () => resolveAda([{ name: 'Ada Lovelace', email: 'ada@example.com' }]));

    expect(within(dialog).queryByRole('button', { name: /Ada Lovelace/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Grace Hopper/ })).toBeInTheDocument();
  });

  it('removes stale options as soon as the query changes', async () => {
    const user = userEvent.setup();
    (ticketsApi.searchDoorAttendees as jest.Mock)
      .mockResolvedValueOnce([{ name: 'Ada Lovelace', email: 'ada@example.com' }])
      .mockImplementationOnce(() => new Promise<DoorAttendee[]>(() => undefined));
    render(<DoorAttendeePick eventId="e1" valueKey="" onPick={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Katılımcı bul' }));
    const dialog = screen.getByRole('dialog', { name: 'Katılımcı bul' });
    const field = within(dialog).getByPlaceholderText('Ad veya e-posta');
    await user.type(field, 'ad');
    expect(await within(dialog).findByRole('button', { name: /Ada Lovelace/ })).toBeInTheDocument();

    await user.type(field, 'a');
    expect(within(dialog).queryByRole('button', { name: /Ada Lovelace/ })).not.toBeInTheDocument();
  });
});
