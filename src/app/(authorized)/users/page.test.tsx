import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import UsersPage from '@/app/(authorized)/users/page';
import { ProblemError } from '@/lib/api/core';
import { capabilitiesApi } from '@/lib/api/capabilities';
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

jest.mock('@/lib/api/capabilities', () => ({
  capabilitiesApi: { get: jest.fn() },
}));

beforeEach(() => {
  (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'user.create': true } });
  (identityApi.userDirectory as jest.Mock).mockResolvedValue({
    items: [{ id: 'u9', firstName: 'Ece', lastName: 'K', email: 'ece@example.com' }],
    total: 1,
    page: 1,
    size: 50,
  });
});

jest.mock('@/lib/api/identity', () => ({
  identityApi: {
    listUsers: jest.fn(),
    userDirectory: jest.fn(),
    createUser: jest.fn(),
    listGroups: jest.fn().mockResolvedValue([]),
    members: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/users',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/lib/api/dashboard', () => ({
  dashboardApi: { summary: jest.fn().mockResolvedValue({ members: null }) },
}));

jest.mock('@skylab-kulubu/skylcn-ui/charts', () => ({
  BarChart: () => null,
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
    await user.click(await screen.findByRole('button', { name: 'Kullanıcı ekle' }));
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

describe('Users page feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (identityApi.listUsers as jest.Mock).mockResolvedValue([]);
  });

  async function submitAda() {
    const user = userEvent.setup();
    render(<UsersPage />);
    await user.click(await screen.findByRole('button', { name: 'Kullanıcı ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Kullanıcı ekle' });
    await user.type(within(dialog).getByLabelText('E-posta'), 'ada@example.com');
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    return dialog;
  }

  it('says the user was added and reads the list again', async () => {
    (identityApi.createUser as jest.Mock).mockResolvedValue({ id: 'u1' });
    await submitAda();
    expect(await screen.findByText('Kullanıcı eklendi')).toBeInTheDocument();
    await waitFor(() => expect(identityApi.userDirectory).toHaveBeenCalledTimes(2));
  });

  it('shows a create error inside the open drawer', async () => {
    (identityApi.createUser as jest.Mock).mockRejectedValue(
      new ProblemError(409, 'Conflict', { detail: 'user exists with same email' }),
    );
    const dialog = await submitAda();
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Kayıt şu anki durumunda buna uygun değil',
    );
  });
});

describe('Users page for a reader', () => {
  it('offers no add button to a DK member (user.create false)', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'user.create': false } });
    render(<UsersPage />);
    expect(await screen.findByRole('searchbox', { name: 'Kullanıcı ara' })).toBeInTheDocument();
    await waitFor(() => expect(capabilitiesApi.get).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Kullanıcı ekle' })).not.toBeInTheDocument();
  });
});
