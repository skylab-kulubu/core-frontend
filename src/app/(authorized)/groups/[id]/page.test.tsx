import { screen, render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import GroupDetailPage from '@/app/(authorized)/groups/[id]/page';
import { ProblemError } from '@/lib/api/core';
import { identityApi } from '@/lib/api/identity';

jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'g1' }) }));
jest.mock('@/lib/api/identity', () => ({
  identityApi: {
    getGroup: jest.fn(),
    members: jest.fn(),
    groupRoles: jest.fn(),
    listUsers: jest.fn(),
    addMember: jest.fn(),
    removeMember: jest.fn(),
  },
}));

describe('Group detail Üye ekle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (identityApi.getGroup as jest.Mock).mockResolvedValue({
      id: 'g1',
      name: 'GECEKODU',
      path: '/UYELER/ORGANIZASYON/GECEKODU',
    });
    (identityApi.members as jest.Mock).mockResolvedValue([]);
    (identityApi.groupRoles as jest.Mock).mockResolvedValue([]);
    (identityApi.listUsers as jest.Mock).mockResolvedValue([
      { id: 'u-ada', email: 'ada@example.com', firstName: 'Ada', lastName: 'L' },
    ]);
  });

  it('asks for two characters before searching the directory', async () => {
    const user = userEvent.setup();
    render(<GroupDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Üye ekle' }));
    expect(screen.getByText('En az 2 karakter yazın')).toBeInTheDocument();
    expect(identityApi.listUsers).not.toHaveBeenCalled();

    await user.type(screen.getByPlaceholderText('Ad, e-posta'), 'ad');
    await waitFor(() => expect(identityApi.listUsers).toHaveBeenCalledWith('ad'));
    expect(identityApi.listUsers).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Ada L')).toBeInTheDocument();
  });
});

describe('Group detail feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (identityApi.getGroup as jest.Mock).mockResolvedValue({
      id: 'g1',
      name: 'GECEKODU',
      path: '/UYELER/ORGANIZASYON/GECEKODU',
    });
    (identityApi.members as jest.Mock).mockResolvedValue([
      { id: 'u-bora', email: 'bora@example.com', firstName: 'Bora', lastName: 'D' },
    ]);
    (identityApi.groupRoles as jest.Mock).mockResolvedValue([]);
    (identityApi.listUsers as jest.Mock).mockResolvedValue([
      { id: 'u-ada', email: 'ada@example.com', firstName: 'Ada', lastName: 'L' },
    ]);
  });

  it('says the member was added', async () => {
    const user = userEvent.setup();
    (identityApi.addMember as jest.Mock).mockResolvedValue(undefined);
    render(<GroupDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Üye ekle' }));
    await user.type(screen.getByPlaceholderText('Ad, e-posta'), 'ada');
    await user.click(await screen.findByRole('button', { name: 'Ada L' }));
    await waitFor(() => expect(identityApi.addMember).toHaveBeenCalledWith('g1', 'u-ada'));
    expect(await screen.findByText('Üye eklendi')).toBeInTheDocument();
  });

  it('shows an add-member error inside the open picker', async () => {
    const user = userEvent.setup();
    (identityApi.addMember as jest.Mock).mockRejectedValue(new ProblemError(403, 'Yetkin yok'));
    render(<GroupDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Üye ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Üye ekle' });
    await user.type(within(dialog).getByPlaceholderText('Ad, e-posta'), 'ada');
    await user.click(await within(dialog).findByRole('button', { name: 'Ada L' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Yetkin yok');
  });

  it('says the member was removed', async () => {
    const user = userEvent.setup();
    (identityApi.removeMember as jest.Mock).mockResolvedValue(undefined);
    render(<GroupDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Çıkar' }));
    const confirm = await screen.findByRole('alertdialog', {
      name: 'Bora D GECEKODU grubundan çıkarılsın mı?',
    });
    expect(confirm).toHaveTextContent('e-posta');
    expect(identityApi.removeMember).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Gruptan çıkar' }));
    await waitFor(() => expect(identityApi.removeMember).toHaveBeenCalledWith('g1', 'u-bora'));
    expect(await screen.findByText('Üye çıkarıldı')).toBeInTheDocument();
  });
});
