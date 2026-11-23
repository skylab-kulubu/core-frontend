import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import AnnouncementsPage from '@/app/(authorized)/announcements/page';
import { newsApi } from '@/lib/api/cms';
import { ProblemError } from '@/lib/api/core';

const replace = jest.fn();
let search = '';
let groups = ['/UYELER/YK'];

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: jest.fn() }),
  usePathname: () => '/announcements',
  useSearchParams: () => new URLSearchParams(search),
}));

/** Starts the page at `/announcements?<query>`, as the address and the hook read it. */
function at(query: string) {
  search = query;
  window.history.replaceState(null, '', query ? `/announcements?${query}` : '/announcements');
}
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'yk', groups, roles: [] } }),
}));
jest.mock('@/lib/api/cms', () => ({
  ...jest.requireActual('@/lib/api/cms'),
  newsApi: { list: jest.fn() },
}));

const ITEMS = [
  {
    id: 'n1',
    collectionKey: 'news',
    slug: 'bahar-senligi',
    version: 1,
    data: { title: 'Bahar şenliği', summary: 'Kampüste', body: '', featured: true, author: 'YK' },
  },
  {
    id: 'n2',
    collectionKey: 'news',
    slug: 'kayit',
    version: 1,
    data: { title: 'Kayıtlar açıldı', body: '', tags: ['duyuru'] },
  },
];

describe('Duyurular', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    at('');
    groups = ['/UYELER/YK'];
    window.localStorage.clear();
    (newsApi.list as jest.Mock).mockResolvedValue({
      items: ITEMS,
      total: 2,
      offset: 0,
      limit: 100,
    });
  });

  it('lists the announcements, each row opening its editor', async () => {
    render(<AnnouncementsPage />);
    const row = await screen.findByRole('link', { name: 'Bahar şenliği' });
    expect(row).toHaveAttribute('href', '/announcements/bahar-senligi/edit');
    expect(screen.getByRole('link', { name: 'Kayıtlar açıldı' })).toBeInTheDocument();
    expect(screen.getByText('2 / 2', { exact: false })).toBeInTheDocument();
  });

  it('writes the main command in the command bar', async () => {
    render(<AnnouncementsPage />);
    const bar = screen.getByRole('group', { name: 'Duyuru komutları' });
    expect(within(bar).getAllByRole('link')[0]).toHaveAttribute('href', '/announcements/new');
    expect(within(bar).getAllByRole('link')[0]).toHaveTextContent('Duyuru ekle');
    await screen.findByRole('link', { name: 'Bahar şenliği' });
  });

  it('reads the view from the address and keeps a new one there', async () => {
    const pointer = userEvent.setup();
    at('view=featured');
    render(<AnnouncementsPage />);
    expect(await screen.findByRole('link', { name: 'Bahar şenliği' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Kayıtlar açıldı' })).not.toBeInTheDocument();
    await pointer.click(screen.getByRole('button', { name: /^Hepsi/ }));
    expect(window.location.search).toBe('');
    expect(replace).not.toHaveBeenCalled();
  });

  it('offers to clear a search that found nothing', async () => {
    const pointer = userEvent.setup();
    at('q=yok');
    render(<AnnouncementsPage />);
    expect(await screen.findByText('Bu süzgeçte sonuç yok')).toBeInTheDocument();
    await pointer.click(screen.getByRole('button', { name: 'Süzgeci temizle' }));
    expect(window.location.search).toBe('');
  });

  it('says a failed read, with the reason when there is one, and a retry', async () => {
    const pointer = userEvent.setup();
    (newsApi.list as jest.Mock).mockRejectedValueOnce(new Error('503'));
    render(<AnnouncementsPage />);
    expect(await screen.findByText('Duyurular yüklenemedi')).toBeInTheDocument();
    await pointer.click(screen.getByRole('button', { name: 'Tekrar dene' }));
    expect(await screen.findByRole('link', { name: 'Bahar şenliği' })).toBeInTheDocument();
  });

  it('says why the read failed when the service says so', async () => {
    (newsApi.list as jest.Mock).mockRejectedValueOnce(new ProblemError(403, 'Forbidden'));
    render(<AnnouncementsPage />);
    expect(await screen.findByText('Bu işlem için yetkin yok.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tekrar dene' })).toBeInTheDocument();
  });

  it('says no access the one way', () => {
    groups = ['/UYELER/ARGE/WEBLAB'];
    render(<AnnouncementsPage />);
    expect(screen.getByText('Bu sayfaya erişimin yok')).toBeInTheDocument();
    expect(newsApi.list).not.toHaveBeenCalled();
  });
});
