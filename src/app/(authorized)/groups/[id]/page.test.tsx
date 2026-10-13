import { screen, render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import GroupDetailPage from '@/app/(authorized)/groups/[id]/page';
import { ProblemError } from '@/lib/api/core';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { identityApi } from '@/lib/api/identity';

jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'g1' }) }));
jest.mock('@/lib/api/capabilities', () => ({
  capabilitiesApi: { get: jest.fn() },
}));

beforeEach(() => {
  (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'group.write': true } });
});

jest.mock('@/lib/api/identity', () => ({
  identityApi: {
    listGroups: jest.fn(),
    listClientRoles: jest.fn(),
    setGroupRoles: jest.fn(),
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
    expect(confirm).toHaveTextContent('e-posta');
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
