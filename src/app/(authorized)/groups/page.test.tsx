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
  (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'group.write': true } });
  (useAuth as jest.Mock).mockReturnValue({ user: { id: 'yk', groups: ['/UYELER/YK'] } });
});

jest.mock('@/lib/api/identity', () => ({
  identityApi: { listGroups: jest.fn(), createGroup: jest.fn() },
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
    expect(await screen.findByText('/UYELER/ARGE/WEBLAB')).toBeInTheDocument();
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
    expect(await screen.findByText('/UYELER/ARGE/WEBLAB')).toBeInTheDocument();
    await waitFor(() => expect(capabilitiesApi.get).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Grup ekle' })).not.toBeInTheDocument();
  });
});
