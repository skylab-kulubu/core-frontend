import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import UserDetailPage from '@/app/(authorized)/users/[id]/page';
import { ProblemError } from '@/lib/api/core';
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
    addMember: jest.fn(),
    logoutUser: jest.fn(),
    removeExtraRole: jest.fn(),
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

describe('User detail feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      extraRoles: [{ clientId: 'forms', role: 'forms:admin' }],
    });
    (identityApi.listGroups as jest.Mock).mockResolvedValue([
      { id: 'g1', name: 'GECEKODU', path: '/UYELER/ORGANIZASYON/GECEKODU' },
    ]);
  });

  it('says the sessions were closed', async () => {
    const user = userEvent.setup();
    (identityApi.logoutUser as jest.Mock).mockResolvedValue(undefined);
    render(<UserDetailPage />);
    await user.click(await screen.findByRole('button', { name: /Oturumları kapat/ }));
    const confirm = await screen.findByRole('alertdialog', {
      name: 'Ada Lovelace için bütün oturumlar kapatılsın mı?',
    });
    expect(identityApi.logoutUser).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Oturumları kapat' }));
    expect(await screen.findByText('Oturumlar kapatıldı')).toBeInTheDocument();
  });

  it('shows a refused session close on the card, not as the unexpected error', async () => {
    const user = userEvent.setup();
    (identityApi.logoutUser as jest.Mock).mockRejectedValue(new ProblemError(403, 'Yetkin yok'));
    render(<UserDetailPage />);
    await user.click(await screen.findByRole('button', { name: /Oturumları kapat/ }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Oturumları kapat',
      }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Yetkin yok');
    expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
  });

  it('says a role was removed, and shows a refused one on the card', async () => {
    const user = userEvent.setup();
    (identityApi.removeExtraRole as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new ProblemError(403, 'Rol kaldırma yetkin yok'));
    render(<UserDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Kaldır' }));
    const confirm = await screen.findByRole('alertdialog', {
      name: 'forms:admin rolü Ada Lovelace kişisinden kaldırılsın mı?',
    });
    await user.click(within(confirm).getByRole('button', { name: 'Rolü kaldır' }));
    expect(await screen.findByText('Rol kaldırıldı')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await user.click(await screen.findByRole('button', { name: 'Kaldır' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Rolü kaldır' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Rol kaldırma yetkin yok');
  });

  it('shows an add-group error inside the open picker and says a success', async () => {
    const user = userEvent.setup();
    (identityApi.addMember as jest.Mock)
      .mockRejectedValueOnce(new ProblemError(403, 'Bu gruba ekleyemezsin'))
      .mockResolvedValueOnce(undefined);
    render(<UserDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Grup ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Grup ekle' });
    await user.click(
      await within(dialog).findByRole('button', { name: '/UYELER/ORGANIZASYON/GECEKODU' }),
    );
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Bu gruba ekleyemezsin');
    await user.click(within(dialog).getByRole('button', { name: '/UYELER/ORGANIZASYON/GECEKODU' }));
    expect(await screen.findByText('Gruba eklendi')).toBeInTheDocument();
  });
});
