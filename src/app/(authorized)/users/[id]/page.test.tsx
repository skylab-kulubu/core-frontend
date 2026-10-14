import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import UserDetailPage from '@/app/(authorized)/users/[id]/page';
import { ProblemError } from '@/lib/api/core';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { identityApi } from '@/lib/api/identity';
import { useAuth } from '@/context/AuthContext';

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/api/capabilities', () => ({
  capabilitiesApi: { get: jest.fn() },
}));

/** core's `can` for an ADMIN/YK member, a DK member (reads only) and a plain reader. */
const ADMIN_CAN = {
  'user.read': true,
  'user.readFull': true,
  'user.write': true,
  'group.write': true,
};
const DK_CAN = {
  'user.read': true,
  'user.readFull': true,
  'user.write': false,
  'group.write': false,
};
const READER_CAN = { 'user.read': true };

beforeEach(() => {
  (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: ADMIN_CAN });
});

jest.mock('@/lib/api/identity', () => ({
  identityApi: {
    getUser: jest.fn(),
    listGroups: jest.fn(),
    listClientRoles: jest.fn(),
    addMember: jest.fn(),
    memberCheck: jest.fn(),
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
    expect(screen.getByText('Doğrudan rol yok')).toBeInTheDocument();
    expect(screen.queryByText('Beklenmeyen bir hata oluştu')).not.toBeInTheDocument();
  });

  it('keeps users:read cards read-only', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: READER_CAN });
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

describe('User detail roles and readers', () => {
  const card = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    phone: '5551112233',
    extraRoles: [{ clientId: 'forms', role: 'forms:admin' }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (identityApi.getUser as jest.Mock).mockResolvedValue(card);
  });

  it('offers no way to give a person a role directly, and keeps removing one', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: ADMIN_CAN });
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'yk', groups: ['/UYELER/YK'] } });
    render(<UserDetailPage />);
    expect(await screen.findByRole('button', { name: 'Kaldır' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Grup ekle' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rol ekle' })).not.toBeInTheDocument();
    expect(screen.getByText('Taşınacak')).toBeInTheDocument();
    expect(identityApi.listClientRoles).not.toHaveBeenCalled();
  });

  it('shows a DK member the full card without a write button', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: DK_CAN });
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'dk', groups: ['/UYELER/DK'] } });
    render(<UserDetailPage />);
    expect(await screen.findByText('5551112233')).toBeInTheDocument();
    expect(screen.getByText('forms:admin')).toBeInTheDocument();
    for (const name of ['Kaydet', 'Grup ekle', 'Rol ekle', 'Kaldır', /Oturumları kapat/]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('falls back to the group rule when the capabilities cannot be read', async () => {
    (capabilitiesApi.get as jest.Mock).mockRejectedValue(new TypeError('Failed to fetch'));
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'yk', groups: ['/UYELER/YK'] } });
    render(<UserDetailPage />);
    expect(await screen.findByRole('button', { name: 'Kaldır' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Oturumları kapat/ })).toBeInTheDocument();
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
    (identityApi.memberCheck as jest.Mock).mockResolvedValue({
      privileged: false,
      ytuLinked: false,
      warnings: [],
    });
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

  it('shows a refused session close inside its dialog, not as the unexpected error', async () => {
    const user = userEvent.setup();
    (identityApi.logoutUser as jest.Mock).mockRejectedValue(
      new ProblemError(403, 'Forbidden', { detail: 'missing role' }),
    );
    render(<UserDetailPage />);
    await user.click(await screen.findByRole('button', { name: /Oturumları kapat/ }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Oturumları kapat' }));
    expect(await within(confirm).findByRole('alert')).toHaveTextContent(
      'Bu işlem için yetkin yok.',
    );
    expect(confirm).not.toHaveTextContent(/Forbidden|missing role/);
    // The card stays behind the open dialog
    expect(screen.getByRole('heading', { name: 'Ada Lovelace', hidden: true })).toBeInTheDocument();
  });

  it('says a role was removed, and shows a refused one inside its dialog', async () => {
    const user = userEvent.setup();
    (identityApi.removeExtraRole as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new ProblemError(403, 'Forbidden', { detail: 'missing role' }));
    render(<UserDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Kaldır' }));
    const confirm = await screen.findByRole('alertdialog', {
      name: 'forms:admin rolü Ada Lovelace kişisinden kaldırılsın mı?',
    });
    await user.click(within(confirm).getByRole('button', { name: 'Rolü kaldır' }));
    expect(await screen.findByText('Rol kaldırıldı')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await user.click(await screen.findByRole('button', { name: 'Kaldır' }));
    const again = await screen.findByRole('alertdialog');
    await user.click(within(again).getByRole('button', { name: 'Rolü kaldır' }));
    expect(await within(again).findByRole('alert')).toHaveTextContent('Bu işlem için yetkin yok.');
  });

  it('shows an add-group error inside the open picker and says a success', async () => {
    const user = userEvent.setup();
    (identityApi.addMember as jest.Mock)
      .mockRejectedValueOnce(new ProblemError(403, 'Forbidden', { detail: 'missing role' }))
      .mockResolvedValueOnce(undefined);
    render(<UserDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Grup ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Grup ekle' });
    await user.click(
      await within(dialog).findByRole('button', { name: '/UYELER/ORGANIZASYON/GECEKODU' }),
    );
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Bu işlem için yetkin yok.');
    await user.click(within(dialog).getByRole('button', { name: '/UYELER/ORGANIZASYON/GECEKODU' }));
    expect(await screen.findByText('Gruba eklendi')).toBeInTheDocument();
  });

  describe('adding to a group as an account not verified with YTÜ', () => {
    beforeEach(() => {
      (identityApi.listGroups as jest.Mock).mockResolvedValue([
        { id: 'g-yk', name: 'YK', path: '/UYELER/YK' },
      ]);
      (identityApi.addMember as jest.Mock).mockResolvedValue(undefined);
    });

    async function pickYk() {
      const user = userEvent.setup();
      render(<UserDetailPage />);
      await user.click(await screen.findByRole('button', { name: 'Grup ekle' }));
      const drawer = await screen.findByRole('dialog', { name: 'Grup ekle' });
      await user.click(await within(drawer).findByRole('button', { name: '/UYELER/YK' }));
      return user;
    }

    it('warns before a Privileged group, and adds once confirmed', async () => {
      (identityApi.memberCheck as jest.Mock).mockResolvedValue({
        privileged: true,
        ytuLinked: false,
        warnings: ['not_ytu_verified'],
      });
      const user = await pickYk();
      const warning = await screen.findByRole('alertdialog', {
        name: 'Ada Lovelace YK grubuna eklensin mi?',
      });
      expect(identityApi.memberCheck).toHaveBeenCalledWith(
        'g-yk',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      );
      expect(warning).toHaveTextContent(
        'Bu hesap YTÜ ile doğrulanmamış. Aynı adlı başka biri olmadığından emin olun.',
      );
      expect(identityApi.addMember).not.toHaveBeenCalled();
      await user.click(within(warning).getByRole('button', { name: 'Yine de ekle' }));
      await waitFor(() =>
        expect(identityApi.addMember).toHaveBeenCalledWith(
          'g-yk',
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          { unverifiedAck: true },
        ),
      );
      expect(await screen.findByText('Gruba eklendi')).toBeInTheDocument();
    });

    it('adds without a question when core gives no warning', async () => {
      await pickYk();
      await waitFor(() =>
        expect(identityApi.addMember).toHaveBeenCalledWith(
          'g-yk',
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        ),
      );
      expect(identityApi.memberCheck).toHaveBeenCalled();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('still adds, without a warning, when the check cannot be read', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      (identityApi.memberCheck as jest.Mock).mockRejectedValue(new TypeError('Failed to fetch'));
      await pickYk();
      await waitFor(() =>
        expect(identityApi.addMember).toHaveBeenCalledWith(
          'g-yk',
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        ),
      );
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(await screen.findByText('Gruba eklendi')).toBeInTheDocument();
      warn.mockRestore();
    });
  });
});
