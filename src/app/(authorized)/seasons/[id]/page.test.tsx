import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import SeasonPage from '@/app/(authorized)/seasons/[id]/page';
import { ProblemError } from '@/lib/api/core';
import { eventsApi } from '@/lib/api/events';
import { seasonsApi } from '@/lib/api/seasons';
import { sceneTitle } from '@/test/error-scenes';

let mockSearch = '';
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 's1' }),
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  usePathname: () => '/seasons/s1',
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

let mockGroups = ['/UYELER/YK'];
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'yk', roles: [], groups: mockGroups } }),
}));

jest.mock('@/lib/api/seasons', () => ({
  seasonsApi: {
    get: jest.fn(),
    listEvents: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    restore: jest.fn(),
    assignEvent: jest.fn(),
    unassignEvent: jest.fn(),
  },
}));
jest.mock('@/lib/api/events', () => ({ eventsApi: { stats: jest.fn(), list: jest.fn() } }));

// jsdom has no PointerEvent; base-ui's Switch sends one on a click
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    Object.defineProperty(window, 'PointerEvent', { value: MouseEvent, configurable: true });
  }
});

const season = {
  id: 's1',
  name: '2026-2027',
  active: true,
  startDate: '2026-09-28T00:00:00+03:00',
  endDate: '2027-05-31T23:59:00+03:00',
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
};
const past = {
  id: 'e1',
  name: 'Tanışma Toplantısı',
  ownerTeam: 'YK',
  status: 'published',
  active: false,
  startDate: '2026-10-03T18:00:00+03:00',
  endDate: '2026-10-03T20:00:00+03:00',
  seasonId: 's1',
};
const coming = {
  id: 'e2',
  name: 'LLM Atölyesi',
  ownerTeam: 'AI-LAB',
  status: 'published',
  active: true,
  startDate: '2027-01-12T18:00:00+03:00',
  seasonId: 's1',
};

function at(section = '') {
  mockSearch = section ? `bolum=${section}` : '';
}

describe('Sezon sayfası', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGroups = ['/UYELER/YK'];
    at();
    (seasonsApi.get as jest.Mock).mockResolvedValue(season);
    (seasonsApi.listEvents as jest.Mock).mockResolvedValue([past, coming]);
    (eventsApi.stats as jest.Mock).mockResolvedValue({
      eventStats: [
        { id: 'e1', applications: 60, checkedIn: 41 },
        { id: 'e2', applications: 12, checkedIn: 0 },
        { id: 'elsewhere', applications: 500, checkedIn: 300 },
      ],
    });
  });

  it('shows the season’s figures: its events, applications and entries only', async () => {
    render(<SeasonPage />);
    expect(await screen.findByRole('heading', { name: '2026-2027' })).toBeInTheDocument();
    const figures = screen.getByRole('group', { name: 'Sezon sayıları' });
    expect(within(figures).getByRole('button', { name: /Etkinlik\s*2/ })).toBeInTheDocument();
    expect(
      await within(figures).findByRole('button', { name: /Başvuru\s*72/ }),
    ).toBeInTheDocument();
    expect(within(figures).getByRole('button', { name: /Katılım\s*41/ })).toBeInTheDocument();
    expect(screen.getByText('1 bitti · 1 sırada')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Etkinlikler/ })[0]).toHaveAttribute(
      'href',
      '/seasons/s1?bolum=etkinlikler',
    );
  });

  it('shows the season without figures it may not read', async () => {
    (eventsApi.stats as jest.Mock).mockRejectedValue(new ProblemError(403, 'Forbidden', {}));
    render(<SeasonPage />);
    const figures = await screen.findByRole('group', { name: 'Sezon sayıları' });
    expect(within(figures).getByRole('button', { name: /Etkinlik\s*2/ })).toBeInTheDocument();
    expect(within(figures).queryByRole('button', { name: /Başvuru/ })).not.toBeInTheDocument();
  });

  it('says a season that is not there as a missing page', async () => {
    (seasonsApi.get as jest.Mock).mockRejectedValue(new ProblemError(404, 'Not Found', {}));
    render(<SeasonPage />);
    expect(
      await screen.findByRole('heading', { name: sceneTitle('notFound') }),
    ).toBeInTheDocument();
  });

  it('lists the season’s events and takes one out after asking', async () => {
    at('etkinlikler');
    (seasonsApi.unassignEvent as jest.Mock).mockResolvedValue(past);
    const user = userEvent.setup();
    render(<SeasonPage />);
    expect(await screen.findByRole('link', { name: 'Tanışma Toplantısı' })).toHaveAttribute(
      'href',
      '/events/e1',
    );
    await user.click(screen.getByRole('button', { name: 'Tanışma Toplantısı: eylemler' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sezondan çıkar' }));
    const ask = await screen.findByRole('alertdialog', {
      name: '"Tanışma Toplantısı" sezondan çıkarılsın mı?',
    });
    expect(seasonsApi.unassignEvent).not.toHaveBeenCalled();
    await user.click(within(ask).getByRole('button', { name: 'Sezondan çıkar' }));
    await waitFor(() => expect(seasonsApi.unassignEvent).toHaveBeenCalledWith('e1'));
    expect(await screen.findByText('Etkinlik sezondan çıkarıldı')).toBeInTheDocument();
  });

  it('links an event from the picker, offering only the ones not in the season', async () => {
    (eventsApi.list as jest.Mock).mockResolvedValue([
      past,
      { ...coming, id: 'e9', name: 'Bahar Şenliği', seasonId: undefined },
    ]);
    (seasonsApi.assignEvent as jest.Mock).mockResolvedValue({});
    const user = userEvent.setup();
    render(<SeasonPage />);
    await user.click(await screen.findByRole('button', { name: 'Etkinlik bağla' }));
    const drawer = await screen.findByRole('dialog', { name: 'Etkinlik bağla' });
    await user.click(await within(drawer).findByRole('button', { name: /Bahar Şenliği/ }));
    expect(within(drawer).queryByText('Tanışma Toplantısı')).not.toBeInTheDocument();
    await waitFor(() => expect(seasonsApi.assignEvent).toHaveBeenCalledWith('s1', 'e9'));
    expect(await screen.findByText('Etkinlik sezona bağlandı')).toBeInTheDocument();
    expect(eventsApi.list).toHaveBeenCalledWith(undefined, 'all');
  });

  it('saves every setting with one Kaydet, an emptied date as null', async () => {
    at('ayarlar');
    (seasonsApi.update as jest.Mock).mockImplementation((_id, body) =>
      Promise.resolve({ ...season, ...body, updatedAt: '2026-11-23T00:00:00Z' }),
    );
    const user = userEvent.setup();
    render(<SeasonPage />);
    const name = await screen.findByLabelText('Ad');
    expect(screen.queryByRole('button', { name: 'Kaydet' })).not.toBeInTheDocument();
    await user.clear(name);
    await user.type(name, '2026-2027 Güz');
    await user.click(screen.getByRole('switch', { name: /Aktif/ }));
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));
    await waitFor(() =>
      expect(seasonsApi.update).toHaveBeenCalledWith('s1', {
        name: '2026-2027 Güz',
        active: false,
        startDate: expect.any(String),
        endDate: expect.any(String),
      }),
    );
    expect(await screen.findByText('Sezon kaydedildi')).toBeInTheDocument();
  });

  it('asks before deleting the season, goes back to the list and offers Geri al', async () => {
    at('ayarlar');
    (seasonsApi.delete as jest.Mock).mockResolvedValue(undefined);
    (seasonsApi.restore as jest.Mock).mockResolvedValue(season);
    const user = userEvent.setup();
    render(<SeasonPage />);
    await user.click(await screen.findByRole('button', { name: 'Sezonu sil' }));
    const ask = await screen.findByRole('alertdialog', { name: '"2026-2027" sezonu silinsin mi?' });
    expect(seasonsApi.delete).not.toHaveBeenCalled();
    await user.click(within(ask).getByRole('button', { name: 'Sezonu sil' }));
    await waitFor(() => expect(seasonsApi.delete).toHaveBeenCalledWith('s1'));
    expect(mockPush).toHaveBeenCalledWith('/seasons');
    expect(await screen.findByText('Sezon silindi')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Geri al' }));
    await waitFor(() => expect(seasonsApi.restore).toHaveBeenCalledWith('s1'));
    expect(mockPush).toHaveBeenLastCalledWith('/seasons/s1');
  });

  it('shows a Member without season.write no settings and no commands to change it', async () => {
    mockGroups = ['/UYELER/ARGE/WEBLAB'];
    render(<SeasonPage />);
    expect(await screen.findByRole('heading', { name: '2026-2027' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Etkinlik bağla' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ayarlar' })).not.toBeInTheDocument();
  });
});
