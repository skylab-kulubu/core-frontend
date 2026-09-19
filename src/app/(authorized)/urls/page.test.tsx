import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import UrlsPage from '@/app/(authorized)/urls/page';
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
});
