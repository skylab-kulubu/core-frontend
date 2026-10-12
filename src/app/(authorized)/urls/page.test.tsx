import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import UrlsPage from '@/app/(authorized)/urls/page';
import { ProblemError } from '@/lib/api/core';
import { urlsApi } from '@/lib/api/urls';
import { useAuth } from '@/context/AuthContext';
import type { UserDto } from '@/types/api';

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/api/urls', () => {
  const actual = jest.requireActual('@/lib/api/urls') as typeof import('@/lib/api/urls');
  return {
    ...actual,
    urlsApi: {
      listMine: jest.fn(),
      listAll: jest.fn(),
      listHits: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    },
  };
});

const short = {
  id: 'u1',
  alias: 'hack',
  url: 'https://skylab.com',
  clickCount: 3,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function user(partial: Partial<UserDto> & Pick<UserDto, 'roles' | 'groups'>): UserDto {
  return {
    id: 'u1',
    username: 'op',
    email: 'op@example.com',
    firstName: 'O',
    lastName: 'P',
    ...partial,
  };
}

describe('Kısa URL hit list', () => {
  beforeEach(() => {
    (urlsApi.listMine as jest.Mock).mockResolvedValue([short]);
    (urlsApi.listAll as jest.Mock).mockResolvedValue([short]);
    (urlsApi.listHits as jest.Mock).mockResolvedValue([]);
  });

  it('hides Tıklamalar for url:create alone', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: user({
        roles: ['url:create'],
        groups: ['/UYELER/ARGE/WEBLAB'],
      }),
    });
    render(<UrlsPage />);
    await waitFor(() => expect(screen.getByText(/skyl\.app\/hack/)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Tıklamalar' })).not.toBeInTheDocument();
    expect(screen.queryByText('En çok tıklanan')).not.toBeInTheDocument();
    expect(screen.queryByText(/tıklama/)).not.toBeInTheDocument();
    expect(urlsApi.listHits).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'url:moderator',
      roles: ['url:moderator'],
      groups: ['/UYELER/ARGE/WEBLAB'],
    },
    {
      name: 'Privileged',
      roles: [],
      groups: ['/UYELER/YK'],
    },
  ])('shows Tıklamalar for $name', async ({ roles, groups }) => {
    (useAuth as jest.Mock).mockReturnValue({
      user: user({ roles, groups }),
    });
    render(<UrlsPage />);
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Tıklamalar' }).length).toBeGreaterThan(0),
    );
  });

  it('renders a hit with createdAt, and a null hits body as empty', async () => {
    const clicker = userEvent.setup();
    (useAuth as jest.Mock).mockReturnValue({
      user: user({ roles: [], groups: ['/UYELER/YK'] }),
    });
    (urlsApi.listHits as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce([
      {
        id: 'h1',
        urlId: 'u1',
        alias: 'hack',
        createdAt: (() => {
          const when = new Date();
          when.setHours(8, 5, 0, 0);
          return when.toISOString();
        })(),
        ip: '203.0.113.9',
        userAgent: 'Safari/18',
        referer: '',
      },
    ]);
    render(<UrlsPage />);
    const buttons = await screen.findAllByRole('button', { name: 'Tıklamalar' });
    await clicker.click(buttons[0]);
    expect(await screen.findByText('Henüz tıklama yok.')).toBeInTheDocument();
    await clicker.click(buttons[0]);
    expect(await screen.findByText('Bugün, 08:05')).toBeInTheDocument();
    expect(screen.getByText(/203\.0\.113\.9/)).toBeInTheDocument();
  });
});

describe('Kısa URL feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (urlsApi.listMine as jest.Mock).mockResolvedValue([short]);
    (urlsApi.listAll as jest.Mock).mockResolvedValue([]);
    (useAuth as jest.Mock).mockReturnValue({
      user: user({ roles: ['url:create'], groups: ['/UYELER/ARGE/WEBLAB'] }),
    });
  });

  it('says the link was shortened', async () => {
    const clicker = userEvent.setup();
    (urlsApi.create as jest.Mock).mockResolvedValue({ ...short, id: 'u2', alias: 'yeni' });
    render(<UrlsPage />);
    await clicker.type(await screen.findByLabelText('Hedef adres'), 'https://skylab.com/yeni');
    await clicker.click(screen.getByRole('button', { name: 'Kısalt' }));
    expect(await screen.findByText('Kısa link oluşturuldu')).toBeInTheDocument();
  });

  it('says the link was deleted and copied', async () => {
    const clicker = userEvent.setup();
    (urlsApi.remove as jest.Mock).mockResolvedValue(undefined);
    render(<UrlsPage />);
    await clicker.click(await screen.findByRole('button', { name: 'Kopyala' }));
    expect(await screen.findByText('Kısa link kopyalandı')).toBeInTheDocument();
    await clicker.click(screen.getByRole('button', { name: 'Sil' }));
    await waitFor(() => expect(urlsApi.remove).toHaveBeenCalledWith('u1'));
    expect(await screen.findByText('Kısa link silindi')).toBeInTheDocument();
  });

  it('shows an edit error inside the open drawer', async () => {
    const clicker = userEvent.setup();
    (urlsApi.update as jest.Mock).mockRejectedValue(new ProblemError(409, 'Bu kısa ad alınmış'));
    render(<UrlsPage />);
    await clicker.click(await screen.findByRole('button', { name: 'Düzenle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Kısa URL düzenle' });
    await clicker.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Bu kısa ad alınmış');
  });
});
