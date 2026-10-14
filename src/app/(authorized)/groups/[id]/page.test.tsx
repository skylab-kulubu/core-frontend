import { act, screen, render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import GroupDetailPage from '@/app/(authorized)/groups/[id]/page';
import { ProblemError } from '@/lib/api/core';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { identityApi } from '@/lib/api/identity';
import { useAuth } from '@/context/AuthContext';

jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'g1' }) }));
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
    getGroup: jest.fn(),
    members: jest.fn(),
    groupRoles: jest.fn(),
    listUsers: jest.fn(),
    addMember: jest.fn(),
    memberCheck: jest.fn(),
    removeMember: jest.fn(),
  },
}));

const NO_WARNING = { privileged: false, ytuLinked: false, warnings: [] };

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
    (identityApi.memberCheck as jest.Mock).mockResolvedValue(NO_WARNING);
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
    (identityApi.addMember as jest.Mock).mockRejectedValue(
      new ProblemError(403, 'Forbidden', { detail: 'missing role' }),
    );
    render(<GroupDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Üye ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Üye ekle' });
    await user.type(within(dialog).getByPlaceholderText('Ad, e-posta'), 'ada');
    await user.click(await within(dialog).findByRole('button', { name: 'Ada L' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Bu işlem için yetkin yok.');
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

describe('Group detail unverified account warning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (identityApi.getGroup as jest.Mock).mockResolvedValue({
      id: 'g1',
      name: 'YK',
      path: '/UYELER/YK',
    });
    (identityApi.members as jest.Mock).mockResolvedValue([]);
    (identityApi.groupRoles as jest.Mock).mockResolvedValue([]);
    (identityApi.listUsers as jest.Mock).mockResolvedValue([
      { id: 'u-ada', email: 'ada@example.com', firstName: 'Ada', lastName: 'L' },
    ]);
    (identityApi.addMember as jest.Mock).mockResolvedValue(undefined);
  });

  async function pickAda() {
    const user = userEvent.setup();
    render(<GroupDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Üye ekle' }));
    const drawer = await screen.findByRole('dialog', { name: 'Üye ekle' });
    await user.type(within(drawer).getByPlaceholderText('Ad, e-posta'), 'ada');
    await user.click(await within(drawer).findByRole('button', { name: 'Ada L' }));
    return user;
  }

  it('warns before adding an account not verified with YTÜ to a Privileged group, and adds once confirmed', async () => {
    (identityApi.memberCheck as jest.Mock).mockResolvedValue({
      privileged: true,
      ytuLinked: false,
      warnings: ['not_ytu_verified'],
    });
    const user = await pickAda();
    const warning = await screen.findByRole('alertdialog', {
      name: 'Ada L YK grubuna eklensin mi?',
    });
    expect(identityApi.memberCheck).toHaveBeenCalledWith('g1', 'u-ada');
    expect(warning).toHaveTextContent(
      'Bu hesap YTÜ ile doğrulanmamış. Aynı adlı başka biri olmadığından emin olun.',
    );
    expect(identityApi.addMember).not.toHaveBeenCalled();
    await user.click(within(warning).getByRole('button', { name: 'Yine de ekle' }));
    await waitFor(() =>
      expect(identityApi.addMember).toHaveBeenCalledWith('g1', 'u-ada', { unverifiedAck: true }),
    );
    expect(await screen.findByText('Üye eklendi')).toBeInTheDocument();
  });

  it('adds nobody when the warning is turned down', async () => {
    (identityApi.memberCheck as jest.Mock).mockResolvedValue({
      privileged: true,
      ytuLinked: false,
      warnings: ['not_ytu_verified'],
    });
    const user = await pickAda();
    const warning = await screen.findByRole('alertdialog', {
      name: 'Ada L YK grubuna eklensin mi?',
    });
    await user.click(within(warning).getByRole('button', { name: 'Vazgeç' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(identityApi.addMember).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Üye ekle' })).toBeInTheDocument();
  });

  it('adds a YTÜ-linked account to a Privileged group without a question', async () => {
    (identityApi.memberCheck as jest.Mock).mockResolvedValue({
      privileged: true,
      ytuLinked: true,
      warnings: [],
    });
    await pickAda();
    await waitFor(() => expect(identityApi.addMember).toHaveBeenCalledWith('g1', 'u-ada'));
    expect(identityApi.memberCheck).toHaveBeenCalledWith('g1', 'u-ada');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Üye eklendi')).toBeInTheDocument();
  });

  it('adds an unverified account to an ordinary group without a question', async () => {
    (identityApi.memberCheck as jest.Mock).mockResolvedValue(NO_WARNING);
    await pickAda();
    await waitFor(() => expect(identityApi.addMember).toHaveBeenCalledWith('g1', 'u-ada'));
    expect(identityApi.memberCheck).toHaveBeenCalledWith('g1', 'u-ada');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('says a refused add inside the question once confirmed', async () => {
    (identityApi.memberCheck as jest.Mock).mockResolvedValue({
      privileged: true,
      ytuLinked: false,
      warnings: ['not_ytu_verified'],
    });
    (identityApi.addMember as jest.Mock).mockRejectedValue(new Error('boom'));
    const user = await pickAda();
    const warning = await screen.findByRole('alertdialog', {
      name: 'Ada L YK grubuna eklensin mi?',
    });
    await user.click(within(warning).getByRole('button', { name: 'Yine de ekle' }));
    expect(await within(warning).findByRole('alert')).toHaveTextContent('Üye eklenemedi');
    expect(identityApi.addMember).toHaveBeenCalledWith('g1', 'u-ada', { unverifiedAck: true });
    expect(screen.queryByText('Üye eklendi')).not.toBeInTheDocument();
  });

  it('drops the question of a check still running when the picker is closed', async () => {
    let answer: (check: unknown) => void = () => undefined;
    (identityApi.memberCheck as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const user = await pickAda();
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Üye ekle' })).not.toBeInTheDocument(),
    );
    await act(async () => {
      answer({ privileged: true, ytuLinked: false, warnings: ['not_ytu_verified'] });
    });
    await user.click(screen.getByRole('button', { name: 'Üye ekle' }));
    expect(await screen.findByRole('dialog', { name: 'Üye ekle' })).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(identityApi.addMember).not.toHaveBeenCalled();
  });

  it('ignores a second pick while the check runs', async () => {
    let answer: (check: unknown) => void = () => undefined;
    (identityApi.memberCheck as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const user = await pickAda();
    await user.click(screen.getByRole('button', { name: 'Ada L' }));
    await act(async () => {
      answer(NO_WARNING);
    });
    expect(await screen.findByText('Üye eklendi')).toBeInTheDocument();
    expect(identityApi.memberCheck).toHaveBeenCalledTimes(1);
    expect(identityApi.addMember).toHaveBeenCalledTimes(1);
  });

  it('still adds, without a warning, when the check cannot be read', async () => {
    const failure = new TypeError('Failed to fetch');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (identityApi.memberCheck as jest.Mock).mockRejectedValue(failure);
    await pickAda();
    await waitFor(() => expect(identityApi.addMember).toHaveBeenCalledWith('g1', 'u-ada'));
    expect(identityApi.memberCheck).toHaveBeenCalledWith('g1', 'u-ada');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Üye eklendi')).toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith(failure);
    warn.mockRestore();
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
