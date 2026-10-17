import { act, screen, render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import GroupDetailPage from '@/app/(authorized)/groups/[id]/page';
import { ProblemError } from '@/lib/api/core';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { identityApi } from '@/lib/api/identity';
import { useAuth } from '@/context/AuthContext';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'g1' }),
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(() => ({ user: { id: 'yk', groups: ['/UYELER/YK'] } })),
}));

jest.mock('@/lib/api/capabilities', () => ({
  capabilitiesApi: { get: jest.fn() },
}));

beforeEach(() => {
  (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'group.write': true } });
  (useAuth as jest.Mock).mockReturnValue({ user: { id: 'yk', groups: ['/UYELER/YK'] } });
});

jest.mock('@/lib/api/identity', () => ({
  identityApi: {
    listGroups: jest.fn(),
    listClientRoles: jest.fn(),
    setGroupRoles: jest.fn(),
    updateGroup: jest.fn(),
    deleteGroup: jest.fn(),
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
    await user.click(await screen.findByRole('checkbox', { name: /Ada L/ }));
    await user.click(screen.getByRole('button', { name: 'Seçilenleri ekle' }));
    await waitFor(() => expect(identityApi.addMember).toHaveBeenCalledWith('g1', 'u-ada'));
    expect(await screen.findByText('Üye eklendi')).toBeInTheDocument();
  });

  it('shows an add-member error inside the open picker', async () => {
    const user = userEvent.setup();
    (identityApi.addMember as jest.Mock).mockRejectedValue(
      new ProblemError(403, 'Forbidden', { detail: 'missing role' }),
    );
    render(<GroupDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Üye ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Üye ekle' });
    await user.type(within(dialog).getByPlaceholderText('Ad, e-posta'), 'ada');
    await user.click(await within(dialog).findByRole('checkbox', { name: /Ada L/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Seçilenleri ekle' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Bu işlem için yetkin yok.');
  });

  it('keeps picks across searches, submits once in order and retries only failures', async () => {
    const user = userEvent.setup();
    let finishFirst!: () => void;
    const first = new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    (identityApi.listUsers as jest.Mock).mockImplementation((query: string) =>
      Promise.resolve(
        query === 'ada'
          ? [{ id: 'u-ada', firstName: 'Ada', lastName: 'L', email: 'ada@example.com' }]
          : [{ id: 'u-cem', firstName: 'Cem', lastName: 'D', email: 'cem@example.com' }],
      ),
    );
    (identityApi.addMember as jest.Mock)
      .mockImplementationOnce(() => first)
      .mockRejectedValueOnce(new ProblemError(403, 'Forbidden'))
      .mockResolvedValueOnce(undefined);
    render(<GroupDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Üye ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Üye ekle' });
    const search = within(dialog).getByPlaceholderText('Ad, e-posta');
    await user.type(search, 'ada');
    await user.click(await within(dialog).findByRole('checkbox', { name: /Ada L/ }));
    await user.clear(search);
    await user.type(search, 'cem');
    await user.click(await within(dialog).findByRole('checkbox', { name: /Cem D/ }));
    expect(within(dialog).getByText('2 kişi seçildi')).toBeInTheDocument();
    expect(identityApi.addMember).not.toHaveBeenCalled();
    await user.dblClick(within(dialog).getByRole('button', { name: 'Seçilenleri ekle' }));
    expect(identityApi.addMember).toHaveBeenCalledTimes(1);
    expect(search).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(dialog).toBeInTheDocument();
    await act(async () => finishFirst());
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Cem D:');
    expect(within(dialog).getByText('1 kişi seçildi')).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'Ada L seçimini kaldır' }),
    ).not.toBeInTheDocument();
    expect(identityApi.members).toHaveBeenCalledTimes(2);
    await user.click(within(dialog).getByRole('button', { name: 'Seçilenleri ekle' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Üye ekle' })).not.toBeInTheDocument(),
    );
    expect((identityApi.addMember as jest.Mock).mock.calls).toEqual([
      ['g1', 'u-ada'],
      ['g1', 'u-cem'],
      ['g1', 'u-cem'],
    ]);
  });

  it('allows adding a member again after removing them on the same page', async () => {
    const user = userEvent.setup();
    const ada = { id: 'u-ada', email: 'ada@example.com', firstName: 'Ada', lastName: 'L' };
    (identityApi.members as jest.Mock)
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([ada])
      .mockResolvedValue([]);
    (identityApi.addMember as jest.Mock).mockReset().mockResolvedValue(undefined);
    (identityApi.removeMember as jest.Mock).mockResolvedValue(undefined);
    render(<GroupDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Üye ekle' }));
    await user.type(screen.getByPlaceholderText('Ad, e-posta'), 'ada');
    await user.click(await screen.findByRole('checkbox', { name: /Ada L/ }));
    await user.click(screen.getByRole('button', { name: 'Seçilenleri ekle' }));
    await user.click(await screen.findByRole('button', { name: 'Çıkar' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Gruptan çıkar' }),
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Üye ekle' }));
    await user.type(screen.getByPlaceholderText('Ad, e-posta'), 'ada');
    await user.click(await screen.findByRole('checkbox', { name: /Ada L/ }));
    await user.click(screen.getByRole('button', { name: 'Seçilenleri ekle' }));
    await waitFor(() => expect(identityApi.addMember).toHaveBeenCalledTimes(2));
  });

  it('says the member was removed', async () => {
    const user = userEvent.setup();
    (identityApi.removeMember as jest.Mock).mockResolvedValue(undefined);
    render(<GroupDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Çıkar' }));
    const confirm = await screen.findByRole('alertdialog', {
      name: 'Bora D GECEKODU grubundan çıkarılsın mı?',
    });
    expect(confirm).toHaveTextContent('Bu ona e-postayla bildirilir.');
    expect(confirm).toHaveTextContent(
      'Yönetim gruplarındaki değişiklik ayrıca yöneticilere bildirilir.',
    );
    expect(confirm).not.toHaveTextContent('ekibin grubu');
    expect(identityApi.removeMember).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Gruptan çıkar' }));
    await waitFor(() => expect(identityApi.removeMember).toHaveBeenCalledWith('g1', 'u-bora'));
    expect(await screen.findByText('Üye çıkarıldı')).toBeInTheDocument();
  });
});

describe('Group detail role mapping', () => {
  function group(path: string) {
    const name = path.split('/').pop() ?? path;
    (identityApi.getGroup as jest.Mock).mockResolvedValue({ id: 'g1', name, path });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (identityApi.members as jest.Mock).mockResolvedValue([]);
    (identityApi.groupRoles as jest.Mock).mockResolvedValue([
      { clientId: 'forms', role: 'skyforms:access' },
    ]);
    (identityApi.listGroups as jest.Mock).mockResolvedValue([]);
    (identityApi.listClientRoles as jest.Mock).mockResolvedValue([
      { clientId: 'forms', role: 'skyforms:access' },
      { clientId: 'skymail', role: 'system-mails:read' },
    ]);
  });

  it('offers no new role on a Team, says where roles go, and still removes one', async () => {
    group('/UYELER/ARGE/WEBLAB');
    render(<GroupDetailPage />);
    expect(await screen.findByText(/Ekip ya da alt ekip grubuna rol verilmez/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rol ekle' })).not.toBeInTheDocument();
    const roles = screen.getByText('Uygulama rolleri').closest('section') as HTMLElement;
    expect(within(roles).getByRole('button', { name: 'Kaldır' })).toBeInTheDocument();
  });

  it('offers a new role on a role group under /ROLLER with nothing under it', async () => {
    group('/ROLLER/SKYMAIL-OKUR');
    (identityApi.listGroups as jest.Mock).mockResolvedValue([
      { id: 'g1', name: 'SKYMAIL-OKUR', path: '/ROLLER/SKYMAIL-OKUR' },
    ]);
    render(<GroupDetailPage />);
    expect(await screen.findByRole('button', { name: 'Rol ekle' })).toBeInTheDocument();
  });

  it('offers no new role on a role group with groups under it', async () => {
    group('/ROLLER/SKYMAIL-OKUR');
    (identityApi.listGroups as jest.Mock).mockResolvedValue([
      { id: 'g1', name: 'SKYMAIL-OKUR', path: '/ROLLER/SKYMAIL-OKUR' },
      { id: 'g2', name: 'ALT', path: '/ROLLER/SKYMAIL-OKUR/ALT' },
    ]);
    render(<GroupDetailPage />);
    expect(await screen.findByText(/Altında grup olan rol grubuna/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rol ekle' })).not.toBeInTheDocument();
  });

  it('says a refused placement and a Keycloak admin role in Turkish inside the picker', async () => {
    const user = userEvent.setup();
    group('/UYELER/ARGE/WEBLAB/LIDERLER');
    (identityApi.setGroupRoles as jest.Mock)
      .mockRejectedValueOnce(
        new ProblemError(409, 'Conflict', {
          code: 'role_placement',
          detail: 'A Team or Sub-team takes no role',
          fields: { reason: 'sub_team_leader_group' },
        }),
      )
      .mockRejectedValueOnce(
        new ProblemError(403, 'Forbidden', {
          code: 'keycloak_admin_role',
          detail: 'realm-management',
        }),
      );
    render(<GroupDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Rol ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rol ekle' });
    await user.click(await within(dialog).findByRole('button', { name: /system-mails:read/ }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Alt ekibin lider grubuna rol verilmez',
    );
    await user.click(within(dialog).getByRole('button', { name: /system-mails:read/ }));
    await waitFor(() =>
      expect(within(dialog).getByRole('alert')).toHaveTextContent('Keycloak yönetim yetkisi'),
    );
    expect(dialog).not.toHaveTextContent(/takes no role|realm-management/);
    expect(identityApi.setGroupRoles).toHaveBeenCalledWith('g1', [
      { clientId: 'forms', role: 'skyforms:access' },
      { clientId: 'skymail', role: 'system-mails:read' },
    ]);
  });

  it('shows no "Rol ekle" on a role group before its subgroups are known', async () => {
    group('/ROLLER/SKYMAIL-OKUR');
    let answer: (rows: unknown[]) => void = () => undefined;
    (identityApi.listGroups as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    render(<GroupDetailPage />);
    expect(await screen.findByText('skyforms:access')).toBeInTheDocument();
    await waitFor(() => expect(capabilitiesApi.get).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Rol ekle' })).not.toBeInTheDocument();
    await act(async () => {
      answer([
        { id: 'g1', name: 'SKYMAIL-OKUR', path: '/ROLLER/SKYMAIL-OKUR' },
        { id: 'g2', name: 'ALT', path: '/ROLLER/SKYMAIL-OKUR/ALT' },
      ]);
    });
    expect(await screen.findByText(/Altında grup olan rol grubuna/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rol ekle' })).not.toBeInTheDocument();
  });

  it('explains only the rule on a refused place that maps no role', async () => {
    group('/UYELER/ARGE');
    (identityApi.groupRoles as jest.Mock).mockResolvedValue([]);
    render(<GroupDetailPage />);
    const rule = await screen.findByText(/Alan grubuna rol verilmez/);
    expect(rule).not.toHaveTextContent('yalnız kaldırılabilir');
  });

  it('says the roles would land in a refused place when a rename is refused', async () => {
    const user = userEvent.setup();
    group('/UYELER/ARGE/WEBLAB/LIDERLER');
    (identityApi.updateGroup as jest.Mock).mockRejectedValue(
      new ProblemError(409, 'Conflict', {
        code: 'role_placement',
        detail: 'A Team or Sub-team takes no role',
        fields: { reason: 'team' },
      }),
    );
    render(<GroupDetailPage />);
    const name = await screen.findByLabelText('Grup adı');
    await user.clear(name);
    await user.type(name, 'FRONTEND');
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Yeni adla bu gruptaki roller kurala aykırı bir yere düşerdi: Ekip ya da alt ekip grubuna rol verilmez',
    );
    expect(alert).toHaveTextContent('LIDERLER ya da KOORDINATORLER');
  });

  it('falls back to the group rule when the capabilities cannot be read', async () => {
    (capabilitiesApi.get as jest.Mock).mockRejectedValue(new TypeError('Failed to fetch'));
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'u', groups: ['/UYELER/ARGE/WEBLAB'] } });
    group('/UYELER/YK');
    render(<GroupDetailPage />);
    expect(await screen.findByText('skyforms:access')).toBeInTheDocument();
    await waitFor(() => expect(capabilitiesApi.get).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Rol ekle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Üye ekle' })).not.toBeInTheDocument();
  });

  it('shows a DK member the group without a write button', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'group.write': false } });
    group('/UYELER/YK');
    (identityApi.members as jest.Mock).mockResolvedValue([
      { id: 'u-bora', email: 'bora@example.com', firstName: 'Bora', lastName: 'D' },
    ]);
    render(<GroupDetailPage />);
    expect((await screen.findAllByText('Bora D')).length).toBeGreaterThan(0);
    await waitFor(() => expect(capabilitiesApi.get).toHaveBeenCalled());
    expect(await screen.findByText('skyforms:access')).toBeInTheDocument();
    for (const name of ['Üye ekle', 'Çıkar', 'Rol ekle', 'Kaldır', 'Kaydet', 'Ekle']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.getByLabelText('Grup adı')).toBeDisabled();
  });
});

describe('Group deletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (identityApi.getGroup as jest.Mock).mockResolvedValue({
      id: 'g1',
      name: 'TANISMAYEMEGIGRUBU',
      path: '/TANISMAYEMEGIGRUBU',
    });
    (identityApi.members as jest.Mock).mockResolvedValue([]);
    (identityApi.groupRoles as jest.Mock).mockResolvedValue([]);
    (identityApi.deleteGroup as jest.Mock).mockResolvedValue(undefined);
  });

  it('requires confirmation and returns to the group list only after success', async () => {
    const user = userEvent.setup();
    render(<GroupDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Grubu sil' }));
    expect(identityApi.deleteGroup).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('alertdialog', {
      name: 'TANISMAYEMEGIGRUBU silinsin mi?',
    });
    expect(dialog).toHaveTextContent('geri alınamaz');
    await user.click(within(dialog).getByRole('button', { name: 'Grubu sil' }));
    await waitFor(() => expect(identityApi.deleteGroup).toHaveBeenCalledWith('g1'));
    expect(mockPush).toHaveBeenCalledWith('/groups');
    expect(await screen.findByText('Grup silindi')).toBeInTheDocument();
  });

  it.each([
    ['not_empty', 'Önce grubun üyelerini ve alt gruplarını taşı veya çıkar.'],
    ['code_in_use', 'Bu gruba bağlı kayıtlar var; grup silinemez.'],
    ['group_delete_protected', 'Bu sistem veya rol grubu buradan silinemez.'],
    ['protected_group', 'Bu grup veya üst grubu korunan roller taşıyor; buradan silinemez.'],
  ])('keeps a %s refusal in the dialog without leaving or cascading', async (code, message) => {
    (identityApi.deleteGroup as jest.Mock).mockRejectedValue(
      new ProblemError(409, 'Conflict', { code }),
    );
    const user = userEvent.setup();
    render(<GroupDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Grubu sil' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Grubu sil' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message);
    expect(mockPush).not.toHaveBeenCalled();
    expect(identityApi.removeMember).not.toHaveBeenCalled();
    expect(identityApi.setGroupRoles).not.toHaveBeenCalled();
  });

  it('does not offer deletion without core group.write', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'group.write': false } });
    render(<GroupDetailPage />);
    await screen.findByText('TANISMAYEMEGIGRUBU', { selector: 'h1' });
    expect(screen.queryByRole('button', { name: 'Grubu sil' })).not.toBeInTheDocument();
  });
});
