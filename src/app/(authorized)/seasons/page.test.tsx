import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import SeasonsPage from '@/app/(authorized)/seasons/page';
import { ProblemError } from '@/lib/api/core';
import { seasonsApi } from '@/lib/api/seasons';

// The address is the list's state: the hook writes history, and this reads it back
const mockListeners = new Set<() => void>();
function mockSubscribe(listener: () => void) {
  mockListeners.add(listener);
  return () => mockListeners.delete(listener);
}
for (const method of ['pushState', 'replaceState'] as const) {
  const original = window.history[method].bind(window.history);
  window.history[method] = (...args: Parameters<History['pushState']>) => {
    original(...args);
    mockListeners.forEach((listener) => listener());
  };
}

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  usePathname: () => '/seasons',
  useSearchParams: () => {
    const { useSyncExternalStore } = jest.requireActual('react') as typeof import('react');
    const text = useSyncExternalStore(
      mockSubscribe,
      () => window.location.search,
      () => '',
    );
    return new URLSearchParams(text);
  },
}));

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

jest.mock('@/lib/api/seasons', () => ({
  seasonsApi: { list: jest.fn(), create: jest.fn(), listEvents: jest.fn() },
}));

const current = {
  id: 's1',
  name: '2026-2027',
  active: true,
  startDate: '2026-09-28T00:00:00+03:00',
  endDate: '2027-05-31T23:59:00+03:00',
};
const last = { id: 's0', name: '2025-2026', active: false };

describe('Sezonlar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState(null, '', '/seasons');
    (seasonsApi.list as jest.Mock).mockResolvedValue([current, last]);
    (seasonsApi.listEvents as jest.Mock).mockImplementation((id: string) =>
      Promise.resolve(id === 's1' ? [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }] : []),
    );
  });

  it('lists the seasons, each a way into its own page, with its events', async () => {
    render(<SeasonsPage />);
    const row = await screen.findByRole('link', { name: '2026-2027' });
    expect(row).toHaveAttribute('href', '/seasons/s1');
    expect(screen.getByRole('link', { name: '2025-2026' })).toHaveAttribute('href', '/seasons/s0');
    expect(screen.getByText('28 Eyl 2026 – 31 May 2027')).toBeInTheDocument();
    // The events of each season, read after the list
    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(screen.getAllByText('Aktif').length).toBeGreaterThan(0);
  });

  it('narrows to the passive seasons with the view chip', async () => {
    const user = userEvent.setup();
    render(<SeasonsPage />);
    await screen.findByRole('link', { name: '2026-2027' });
    await user.click(screen.getByRole('button', { name: /^Pasif/ }));
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: '2026-2027' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('link', { name: '2025-2026' })).toBeInTheDocument();
  });

  it('adds a season and opens its page', async () => {
    const user = userEvent.setup();
    (seasonsApi.create as jest.Mock).mockResolvedValue({ ...current, id: 's2', name: 'Yeni' });
    render(<SeasonsPage />);
    await user.click(await screen.findByRole('button', { name: 'Sezon ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sezon ekle' });
    await user.type(within(dialog).getByLabelText('Ad'), 'Yeni');
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() =>
      expect(seasonsApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Yeni', active: true }),
      ),
    );
    expect(await screen.findByText('Sezon eklendi')).toBeInTheDocument();
    expect(mockPush).toHaveBeenCalledWith('/seasons/s2');
  });

  it('keeps a refused season in the drawer with core’s reason', async () => {
    const user = userEvent.setup();
    (seasonsApi.create as jest.Mock).mockRejectedValue(
      new ProblemError(409, 'Conflict', { detail: 'season name exists' }),
    );
    render(<SeasonsPage />);
    await user.click(await screen.findByRole('button', { name: 'Sezon ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sezon ekle' });
    await user.type(within(dialog).getByLabelText('Ad'), '2026-2027');
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Kayıt şu anki durumunda buna uygun değil',
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('says when the list could not be read, and reads it again', async () => {
    const user = userEvent.setup();
    (seasonsApi.list as jest.Mock).mockRejectedValueOnce(new Error('down'));
    render(<SeasonsPage />);
    expect(await screen.findByText('Sezonlar yüklenemedi')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tekrar dene' }));
    expect(await screen.findByRole('link', { name: '2026-2027' })).toBeInTheDocument();
  });
});
