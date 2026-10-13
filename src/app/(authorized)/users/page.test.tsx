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
});

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

  it('reads the directory only for a search of two or more characters', async () => {
    const user = userEvent.setup();
    (identityApi.listUsers as jest.Mock).mockResolvedValue([
      { id: 'u-ada', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' },
    ]);
    render(<UsersPage />);
    expect(screen.getByText('Aramak için yaz')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Kullanıcı ara' }), 'A');
    expect(screen.getByText('Aramak için yaz')).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: 'Kullanıcı ara' }), 'd');

    expect(await screen.findByRole('link', { name: /Ada Lovelace/ })).toBeInTheDocument();
    expect(identityApi.listUsers).toHaveBeenCalledTimes(1);
    expect(identityApi.listUsers).toHaveBeenCalledWith('Ad');
  });

  it('shows the created user by searching for its e-mail', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);
    await user.click(await screen.findByRole('button', { name: 'Kullanıcı ekle' }));
    await user.type(screen.getByLabelText('E-posta'), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => expect(identityApi.listUsers).toHaveBeenCalledWith('ada@example.com'));
  });

  describe('with slow answers', () => {
    const person = (id: string, firstName: string) => ({
      id,
      email: `${id}@example.com`,
      firstName,
      lastName: 'K',
    });

    function deferredSearches() {
      const pending = new Map<string, (rows: unknown[]) => void>();
      (identityApi.listUsers as jest.Mock).mockImplementation(
        (q: string) => new Promise((resolve) => pending.set(q, resolve)),
      );
      return pending;
    }

    it('keeps the latest search when an older answer arrives after it', async () => {
      const user = userEvent.setup();
      const pending = deferredSearches();
      render(<UsersPage />);
      const box = screen.getByRole('searchbox', { name: 'Kullanıcı ara' });

      await user.type(box, 'ab');
      await waitFor(() => expect(pending.has('ab')).toBe(true));
      await user.type(box, 'c');
      await waitFor(() => expect(pending.has('abc')).toBe(true));

      await act(async () => pending.get('abc')?.([person('u-new', 'Abc')]));
      await act(async () => pending.get('ab')?.([person('u-old', 'Ab')]));

      expect(screen.getByRole('link', { name: /Abc K/ })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^Ab K/ })).not.toBeInTheDocument();
    });

    it('does not bring rows back after the box is cleared', async () => {
      const user = userEvent.setup();
      const pending = deferredSearches();
      render(<UsersPage />);
      const box = screen.getByRole('searchbox', { name: 'Kullanıcı ara' });

      await user.type(box, 'ab');
      await waitFor(() => expect(pending.has('ab')).toBe(true));
      await user.clear(box);
      await act(async () => pending.get('ab')?.([person('u-old', 'Ab')]));

      expect(screen.getByText('Aramak için yaz')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Ab K/ })).not.toBeInTheDocument();
    });

    it('drops a failed search once the box is cleared', async () => {
      const user = userEvent.setup();
      (identityApi.listUsers as jest.Mock).mockRejectedValue(new Error('down'));
      render(<UsersPage />);
      const box = screen.getByRole('searchbox', { name: 'Kullanıcı ara' });

      await user.type(box, 'ab');
      expect(await screen.findByText('Kullanıcılar yüklenemedi')).toBeInTheDocument();
      await user.clear(box);
      expect(screen.queryByText('Kullanıcılar yüklenemedi')).not.toBeInTheDocument();
      expect(screen.getByText('Aramak için yaz')).toBeInTheDocument();
    });
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

  it('says the user was added', async () => {
    (identityApi.createUser as jest.Mock).mockResolvedValue({ id: 'u1' });
    await submitAda();
    expect(await screen.findByText('Kullanıcı eklendi')).toBeInTheDocument();
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
    expect(await screen.findByText('Üye dizinini görüntüle.')).toBeInTheDocument();
    await waitFor(() => expect(capabilitiesApi.get).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Kullanıcı ekle' })).not.toBeInTheDocument();
  });
});
