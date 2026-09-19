import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import UsersPage from '@/app/(authorized)/users/page';
import { identityApi } from '@/lib/api/identity';

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

jest.mock('@/lib/api/identity', () => ({
  identityApi: {
    listUsers: jest.fn(),
    createUser: jest.fn(),
  },
}));

describe('Users page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (identityApi.listUsers as jest.Mock).mockResolvedValue([]);
    (identityApi.createUser as jest.Mock).mockResolvedValue({ id: 'u1' });
  });

  it('validates and trims the create-user form before submission', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);
    await waitFor(() => expect(identityApi.listUsers).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: 'Kullanıcı ekle' }));
    await user.type(screen.getByLabelText('Ad'), '  Ada  ');
    await user.type(screen.getByLabelText('Soyad'), '  Lovelace  ');
    await user.type(screen.getByLabelText('E-posta'), 'geçersiz');
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(identityApi.createUser).not.toHaveBeenCalled();
    expect(screen.getByText('Geçerli bir e-posta girin.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('E-posta'));
    await user.type(screen.getByLabelText('E-posta'), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));
    await waitFor(() =>
      expect(identityApi.createUser).toHaveBeenCalledWith({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
      }),
    );
  });
});
