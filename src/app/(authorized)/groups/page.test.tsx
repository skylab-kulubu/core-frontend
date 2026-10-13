import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import GroupsPage from '@/app/(authorized)/groups/page';
import { ProblemError } from '@/lib/api/core';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { identityApi } from '@/lib/api/identity';

jest.mock('@/lib/api/capabilities', () => ({
  capabilitiesApi: { get: jest.fn() },
}));

beforeEach(() => {
  (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'group.write': true } });
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
