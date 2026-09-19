import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import UserDetailPage from '@/app/(authorized)/users/[id]/page';
import { identityApi } from '@/lib/api/identity';
import { useAuth } from '@/context/AuthContext';

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/api/identity', () => ({
  identityApi: {
    getUser: jest.fn(),
    listGroups: jest.fn(),
    listClientRoles: jest.fn(),
  },
}));

describe('User detail page', () => {
  it('renders a GET /v1/users/{id} body that omits empty slices and privileged-only fields', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: 'yk',
        username: 'yk',
        email: 'yk@example.com',
        firstName: 'Y',
        lastName: 'K',
        roles: [],
        groups: ['/UYELER/YK'],
      },
    });
    (identityApi.getUser as jest.Mock).mockResolvedValue({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    render(<UserDetailPage />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument(),
    );
    expect(screen.getByText('Grup yok')).toBeInTheDocument();
    expect(screen.getByText('Miras rol yok')).toBeInTheDocument();
    expect(screen.getByText('Ekstra rol yok')).toBeInTheDocument();
    expect(screen.queryByText('Beklenmeyen bir hata oluştu')).not.toBeInTheDocument();
  });

  it('keeps users:read cards read-only', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: 'reader',
        username: 'reader',
        email: 'reader@example.com',
        firstName: 'Read',
        lastName: 'Only',
        roles: ['users:read'],
        groups: ['/SERVICES/FORMS'],
      },
    });
    (identityApi.getUser as jest.Mock).mockResolvedValue({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    render(<UserDetailPage />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: 'Grup ekle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rol ekle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Oturumları kapat/ })).not.toBeInTheDocument();
  });
});
