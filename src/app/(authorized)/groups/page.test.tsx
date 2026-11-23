import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import GroupsPage from '@/app/(authorized)/groups/page';
import { ProblemError } from '@/lib/api/core';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { identityApi } from '@/lib/api/identity';
import { useAuth } from '@/context/AuthContext';

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(() => ({ user: { id: 'yk', groups: ['/UYELER/YK'] } })),
}));

jest.mock('@/lib/api/capabilities', () => ({
  capabilitiesApi: { get: jest.fn() },
}));

beforeEach(() => {
  mockSearch = '';
  (identityApi.managedGroups as jest.Mock).mockResolvedValue([]);
  (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'group.write': true } });
  (useAuth as jest.Mock).mockReturnValue({ user: { id: 'yk', groups: ['/UYELER/YK'] } });
});

jest.mock('@/lib/api/identity', () => ({
  identityApi: { listGroups: jest.fn(), createGroup: jest.fn(), managedGroups: jest.fn() },
}));

let mockSearch = '';
jest.mock('next/navigation', () => ({
  usePathname: () => '/groups',
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

async function createGroup(name: string) {
  const user = userEvent.setup();
  render(<GroupsPage />);
  await user.click(await screen.findByRole('button', { name: 'Grup ekle' }));
  const dialog = await screen.findByRole('dialog', { name: 'Grup ekle' });
  await user.type(within(dialog).getByLabelText('Ad'), name);
  await user.click(within(dialog).getByRole('button', { name: 'Oluştur' }));
  return dialog;
}

describe('Groups page feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (identityApi.listGroups as jest.Mock).mockResolvedValue([]);
  });

  it('says the group was created', async () => {
    (identityApi.createGroup as jest.Mock).mockResolvedValue({
      id: 'g2',
      name: 'WEBLAB',
      path: '/WEBLAB',
    });
    await createGroup('WEBLAB');
    expect(await screen.findByText('Grup oluşturuldu')).toBeInTheDocument();
  });

  it('shows a create error inside the open drawer', async () => {
    (identityApi.createGroup as jest.Mock).mockRejectedValue(
      new ProblemError(409, 'Conflict', { detail: 'group exists' }),
    );
    const dialog = await createGroup('WEBLAB');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Kayıt şu anki durumunda buna uygun değil',
    );
  });
});

describe('Groups page for a reader', () => {
  it('offers no add button to a DK member (group.write false)', async () => {
    (identityApi.listGroups as jest.Mock).mockResolvedValue([
      { id: 'g1', name: 'WEBLAB', path: '/UYELER/ARGE/WEBLAB' },
    ]);
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'group.write': false } });
    render(<GroupsPage />);
    expect((await screen.findAllByText('WEBLAB')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Grup ekle' })).not.toBeInTheDocument();
  });
});

describe('Groups page create under a role group', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (identityApi.listGroups as jest.Mock).mockResolvedValue([]);
  });

  it('says a role group takes no group under it, not the mapping sentence', async () => {
    (identityApi.createGroup as jest.Mock).mockRejectedValue(
      new ProblemError(409, 'Conflict', {
        code: 'role_placement',
        detail: 'A role group under /ROLLER stays a leaf',
        fields: { reason: 'roles_group_not_leaf' },
      }),
    );
    const dialog = await createGroup('ALT');
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Rol grubunun altına grup açılmaz');
    expect(alert).not.toHaveTextContent(/Altında grup olan rol grubuna|stays a leaf/);
  });
});

describe('Groups page when the capabilities cannot be read', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (identityApi.listGroups as jest.Mock).mockResolvedValue([
      { id: 'g1', name: 'WEBLAB', path: '/UYELER/ARGE/WEBLAB' },
    ]);
    (capabilitiesApi.get as jest.Mock).mockRejectedValue(new TypeError('Failed to fetch'));
  });

  it('keeps the add button for a Privileged member', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'yk', groups: ['/UYELER/YK'] } });
    render(<GroupsPage />);
    expect(await screen.findByRole('button', { name: 'Grup ekle' })).toBeInTheDocument();
  });

  it('offers no add button to anyone else', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'u', groups: ['/UYELER/ARGE/WEBLAB'] } });
    render(<GroupsPage />);
    expect((await screen.findAllByText('WEBLAB')).length).toBeGreaterThan(0);
    await waitFor(() => expect(capabilitiesApi.get).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Grup ekle' })).not.toBeInTheDocument();
  });
});

describe('Groups as a tree', () => {
  const GROUPS = [
    { id: 'g-yk', name: 'YK', path: '/YK' },
    { id: 'g-uyeler', name: 'UYELER', path: '/UYELER' },
    { id: 'g-arge', name: 'ARGE', path: '/UYELER/ARGE' },
    {
      id: 'g-web',
      name: 'WEBLAB',
      path: '/UYELER/ARGE/WEBLAB',
      attributes: { display_name_tr: 'Web Lab' },
    },
    { id: 'g-ai', name: 'AI-LAB', path: '/UYELER/ARGE/AI-LAB' },
  ];
  const TREE = [
    { id: 'g-web', code: 'WEBLAB', path: '/UYELER/ARGE/WEBLAB', memberCount: 7, leaderCount: 0 },
    { id: 'g-ai', code: 'AI-LAB', path: '/UYELER/ARGE/AI-LAB', memberCount: 18, leaderCount: 2 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (identityApi.listGroups as jest.Mock).mockResolvedValue(GROUPS);
    (identityApi.managedGroups as jest.Mock).mockResolvedValue(TREE);
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      can: { 'group.write': true, 'group.read': true },
    });
  });

  it('lists every Group under its parent, with a Team’s counts from core’s tree', async () => {
    render(<GroupsPage />);
    const web = await screen.findByRole('button', { name: /^Web Lab/ });
    expect(web).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('18')).toBeInTheDocument());
    expect(screen.getByText('Yok')).toBeInTheDocument();
    // Ekip 2, Ekiplerde üye 25, Lidersiz ekip 1
    const summary = screen.getByRole('group', { name: 'Özet' });
    expect(within(summary).getByText('25')).toBeInTheDocument();
    expect(within(summary).getByRole('button', { name: /Lidersiz ekip/ })).toHaveTextContent('1');
  });

  it('folds the Groups under a Group', async () => {
    const user = userEvent.setup();
    render(<GroupsPage />);
    await screen.findByRole('button', { name: /^Web Lab/ });
    await user.click(screen.getByRole('button', { name: 'ARGE: kapat' }));
    expect(screen.queryByRole('button', { name: /^Web Lab/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'ARGE: aç' }));
    expect(screen.getByRole('button', { name: /^Web Lab/ })).toBeInTheDocument();
  });

  it('shows only the Teams in the Ekipler view, the former Ekipler page', async () => {
    mockSearch = 'view=teams';
    render(<GroupsPage />);
    expect(await screen.findByRole('button', { name: /^Web Lab/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^YK/ })).toBeNull();
    expect(screen.getByText('/UYELER/ARGE/WEBLAB')).toBeInTheDocument();
  });

  it('opens a Group beside the list with its Team facts and a way to its page', async () => {
    mockSearch = 'panel=g-web';
    render(<GroupsPage />);
    const panel = await screen.findByRole('dialog', { name: /^Web Lab/ });
    await waitFor(() => expect(within(panel).getByText('7')).toBeInTheDocument());
    expect(within(panel).getByRole('link', { name: /Tam sayfa/ })).toHaveAttribute(
      'href',
      '/groups/g-web',
    );
    expect(within(panel).getByRole('link', { name: /Etkinlikler/ })).toHaveAttribute(
      'href',
      '/events?ownerTeam=WEBLAB',
    );
  });
});
