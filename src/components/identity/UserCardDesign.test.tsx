import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import type { UserCard } from '@/lib/api/identity';
import { UserCardDesign } from './UserCardDesign';

const card: UserCard = {
  id: 'u1',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  skyNumber: 'SKY-1',
  department: 'Bilgisayar',
  phone: '555',
  groups: [{ id: 'g-web', name: 'WEBLAB', path: '/UYELER/ARGE/WEBLAB' }],
  inheritedRoles: [{ clientId: 'skymail', role: 'send' }],
  extraRoles: [{ clientId: 'core', role: 'events:write' }],
};

describe.each(['a', 'b'] as const)('UserCardDesign %s', (variant) => {
  it('keeps groups, roles, the direct role and every action', async () => {
    const onLogout = jest.fn();
    const onAddGroup = jest.fn();
    const onRemoveRole = jest.fn();
    render(
      <UserCardDesign
        variant={variant}
        card={card}
        canEditProfile
        canReadFull
        onSaveProfile={jest.fn()}
        onLogout={onLogout}
        onAddGroup={onAddGroup}
        onRemoveRole={onRemoveRole}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByText('555')).toBeInTheDocument();
    if (variant === 'b') {
      await userEvent.click(screen.getByRole('button', { name: 'Eylemler' }));
      await userEvent.click(await screen.findByRole('menuitem', { name: 'Oturumları kapat' }));
      await userEvent.click(screen.getByRole('tab', { name: /Gruplar/ }));
    } else {
      await userEvent.click(screen.getByRole('button', { name: 'Oturumları kapat' }));
    }
    expect(onLogout).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: /WEBLAB/ })).toHaveAttribute('href', '/groups/g-web');
    await userEvent.click(screen.getByRole('button', { name: 'Grup ekle' }));
    expect(onAddGroup).toHaveBeenCalled();
    if (variant === 'b') await userEvent.click(screen.getByRole('tab', { name: /Roller/ }));
    expect(screen.getByText('send')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Kaldır' }));
    expect(onRemoveRole).toHaveBeenCalledWith({ clientId: 'core', role: 'events:write' });
  });

  it('edits the profile in place', async () => {
    const onSaveProfile = jest.fn();
    render(
      <UserCardDesign variant={variant} card={card} canEditProfile onSaveProfile={onSaveProfile} />,
    );
    if (variant === 'b') await userEvent.click(screen.getByRole('tab', { name: 'Profil' }));
    await userEvent.click(screen.getByRole('button', { name: 'Düzenle' }));
    await userEvent.clear(screen.getByLabelText('Bölüm'));
    await userEvent.type(screen.getByLabelText('Bölüm'), 'Elektrik');
    await userEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(onSaveProfile).toHaveBeenCalledWith(expect.objectContaining({ department: 'Elektrik' }));
  });
});
