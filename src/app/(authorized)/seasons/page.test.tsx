import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import SeasonsPage from '@/app/(authorized)/seasons/page';
import { ProblemError } from '@/lib/api/core';
import { seasonsApi } from '@/lib/api/seasons';

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'yk',
      username: 'yk',
      email: 'yk@example.com',
      firstName: 'Y',
      lastName: 'K',
      roles: [],
      groups: ['/UYELER/YK'],
    },
  }),
}));

jest.mock('@/lib/api/events', () => ({ eventsApi: { list: jest.fn().mockResolvedValue([]) } }));

jest.mock('@/lib/api/seasons', () => ({
  seasonsApi: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    restore: jest.fn(),
    assignEvent: jest.fn(),
  },
}));

const season = { id: 's1', name: '2026-2027', active: true };

describe('Seasons page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (seasonsApi.list as jest.Mock).mockResolvedValue([season]);
  });

  it('says a new season was added', async () => {
    const user = userEvent.setup();
    (seasonsApi.create as jest.Mock).mockResolvedValue({ ...season, id: 's2', name: 'Yeni' });
    render(<SeasonsPage />);
    await user.click(await screen.findByRole('button', { name: 'Sezon ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sezon ekle' });
    await user.type(within(dialog).getByLabelText('Ad'), 'Yeni');
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    expect(await screen.findByText('Sezon eklendi')).toBeInTheDocument();
  });

  it('shows a save error inside the open drawer and keeps the list', async () => {
    const user = userEvent.setup();
    (seasonsApi.update as jest.Mock).mockRejectedValue(
      new ProblemError(409, 'Conflict', { detail: 'season name exists' }),
    );
    render(<SeasonsPage />);
    await user.click(await screen.findByRole('button', { name: 'Düzenle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sezonu düzenle' });
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Bu adla bir sezon zaten var.',
    );
    expect(screen.getByText('2026-2027')).toBeInTheDocument();
  });

  it('asks before deleting the season, then offers Geri al', async () => {
    const user = userEvent.setup();
    (seasonsApi.delete as jest.Mock).mockResolvedValue(undefined);
    (seasonsApi.restore as jest.Mock).mockResolvedValue(season);
    render(<SeasonsPage />);
    await user.click(await screen.findByRole('button', { name: 'Düzenle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sezonu düzenle' });
    await user.click(within(dialog).getByRole('button', { name: 'Sil' }));
    const confirm = await screen.findByRole('alertdialog', {
      name: '"2026-2027" sezonu silinsin mi?',
    });
    expect(seasonsApi.delete).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Sezonu sil' }));
    await waitFor(() => expect(seasonsApi.delete).toHaveBeenCalledWith('s1'));
    expect(await screen.findByText('Sezon silindi')).toBeInTheDocument();
    await waitFor(() => expect(seasonsApi.list).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole('button', { name: 'Geri al' }));
    await waitFor(() => expect(seasonsApi.restore).toHaveBeenCalledWith('s1'));
    expect(await screen.findByText('Sezon geri alındı')).toBeInTheDocument();
    await waitFor(() => expect(seasonsApi.list).toHaveBeenCalledTimes(3));
  });
});
