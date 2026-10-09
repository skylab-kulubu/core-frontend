import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { NewEventProvider, useNewEvent } from '@/components/scheduling/NewEventProvider';
import { ProblemError } from '@/lib/api/core';
import { EventSaveIncomplete, saveEventWithSeason } from '@/lib/scheduling/save-event';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', groups: ['/UYELER/YK'], roles: [] } }),
}));

jest.mock('@/lib/api/teams', () => ({
  teamsApi: { list: jest.fn().mockResolvedValue([{ team: 'WEBLAB' }, { team: 'AIRLAB' }]) },
}));

jest.mock('@/lib/scheduling/save-event', () => ({
  ...jest.requireActual('@/lib/scheduling/save-event'),
  saveEventWithSeason: jest.fn(),
}));

const save = saveEventWithSeason as jest.Mock;

function Opener() {
  const { open } = useNewEvent();
  return (
    <button type="button" onClick={open}>
      Etkinlik oluştur
    </button>
  );
}

async function openAndFill() {
  const user = userEvent.setup();
  render(
    <NewEventProvider>
      <Opener />
    </NewEventProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'Etkinlik oluştur' }));
  await user.type(await screen.findByLabelText('Ad'), 'Gece Kodu 2026');
  await user.type(screen.getByLabelText('Konum'), 'Davutpaşa');
  await waitFor(() => expect(screen.getByRole('option', { name: 'WEBLAB' })).toBeInTheDocument());
  await user.selectOptions(screen.getByLabelText('Sahip ekip'), 'WEBLAB');
  return user;
}

describe('NewEventProvider', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates the event from the panel and opens it', async () => {
    save.mockResolvedValueOnce('e-new');
    const user = await openAndFill();
    await user.click(screen.getByRole('button', { name: 'Oluştur ve aç' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/events/e-new'));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Gece Kodu 2026',
        location: 'Davutpaşa',
        ownerTeam: 'WEBLAB',
      }),
      undefined,
    );
  });

  it('asks for a name and a place before saving', async () => {
    const user = userEvent.setup();
    render(
      <NewEventProvider>
        <Opener />
      </NewEventProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Etkinlik oluştur' }));
    await user.type(await screen.findByLabelText('Ad'), 'Gece Kodu 2026');
    // The browser's own required check is skipped so the panel's message shows
    const form = screen.getByRole('button', { name: 'Oluştur ve aç' }).closest('form')!;
    form.noValidate = true;
    await user.click(screen.getByRole('button', { name: 'Oluştur ve aç' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Konum gerekli.');
    expect(save).not.toHaveBeenCalled();
  });

  it('updates the event a half-finished save created instead of creating another', async () => {
    save
      .mockRejectedValueOnce(
        new EventSaveIncomplete('e-new', new ProblemError(500, 'Sunucu hatası')),
      )
      .mockResolvedValueOnce('e-new');
    const user = await openAndFill();
    await user.click(screen.getByRole('button', { name: 'Oluştur ve aç' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Etkinlik oluşturuldu ama kaydı tamamlanamadı',
    );

    await user.click(screen.getByRole('button', { name: 'Oluştur ve aç' }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/events/e-new'));
    expect(save).toHaveBeenLastCalledWith(expect.anything(), 'e-new');
  });
});
