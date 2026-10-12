import { screen, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import GroupDetailPage from '@/app/(authorized)/groups/[id]/page';
import { identityApi } from '@/lib/api/identity';

jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'g1' }) }));
jest.mock('@/lib/api/identity', () => ({
  identityApi: {
    getGroup: jest.fn(),
    members: jest.fn(),
    groupRoles: jest.fn(),
    listUsers: jest.fn(),
    addMember: jest.fn(),
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
