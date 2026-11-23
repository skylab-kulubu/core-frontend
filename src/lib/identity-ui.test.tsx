import { render, screen } from '@testing-library/react';
import React from 'react';
import userEvent from '@testing-library/user-event';
import { canManageHandoffTargets, isLeader, isPrivileged } from '@/lib/auth/groups';
import { filterSidebarNavForUser } from '@/lib/navigation/sidebar-nav';
import { UserCardView } from '@/components/identity/UserCardView';
import type { UserDto } from '@/types/api';

describe('isPrivileged', () => {
  it('YK path is privileged', () => {
    expect(isPrivileged(['/UYELER/YK'])).toBe(true);
  });
  it('team member is not', () => {
    expect(isPrivileged(['/UYELER/ARGE/WEBLAB'])).toBe(false);
  });
  it('reads only the six roots and the Groups under them (ADR 0065 decision 6)', () => {
    for (const path of ['/ADMIN', '/YK/BASKAN', '/DK', '/UYELER/ADMIN', '/UYELER/DK/X']) {
      expect(isPrivileged([path])).toBe(true);
    }
    for (const path of ['/UYELER/ARGE/YK', '/UYELER/ARGE/WEBLAB/ADMIN', '/ROLLER/DK', '/YKX']) {
      expect(isPrivileged([path])).toBe(false);
    }
  });
});

describe('isLeader and canManageHandoffTargets (anchored as core reads them)', () => {
  it('reads a Leader group as the last whole segment', () => {
    expect(isLeader(['/UYELER/ARGE/WEBLAB/LIDERLER'])).toBe(true);
    expect(isLeader(['/UYELER/ARGE/WEBLAB/MOBIL/KOORDINATORLER'])).toBe(true);
    for (const path of [
      '/UYELER/ARGE/WEBLAB/LIDERLER-ESKI',
      '/UYELER/X/LIDERLER/ALT',
      '/LIDERLER',
    ]) {
      expect(isLeader([path])).toBe(false);
    }
  });
  it('offers the handoff settings only to the ADMIN group, as sky-handoff decides', () => {
    expect(canManageHandoffTargets(['/ADMIN'])).toBe(true);
    expect(canManageHandoffTargets(['/ADMIN/WEB'])).toBe(true);
    // sky-handoff admits its admin group (/ADMIN) and its subgroups only
    expect(canManageHandoffTargets(['/UYELER/ADMIN/ALT'])).toBe(false);
    expect(canManageHandoffTargets(['/UYELER/ARGE/ADMIN'])).toBe(false);
  });
});

describe('filterSidebarNavForUser', () => {
  it('Privileged sees identity, duyurular, and scheduling', () => {
    const user: UserDto = {
      id: '1',
      username: 'yk',
      email: 'yk@example.com',
      firstName: 'Y',
      lastName: 'K',
      roles: [],
      groups: ['/UYELER/YK'],
    };
    expect(filterSidebarNavForUser(user).map((l) => l.href)).toEqual([
      '/dashboard',
      '/events',
      '/users',
      '/groups',
      '/announcements',
      '/urls',
      '/seasons',
      '/certificates/templates',
      '/certificates/defaults',
    ]);
    expect(filterSidebarNavForUser(user).map((l) => l.href)).not.toContain('/sessions');
  });
  it('Leader sees events and the certificate settings without a sessions page', () => {
    const user: UserDto = {
      id: '3',
      username: 'lead',
      email: 'lead@example.com',
      firstName: 'L',
      lastName: 'E',
      roles: [],
      groups: ['/UYELER/ARGE/WEBLAB/LIDERLER'],
    };
    expect(filterSidebarNavForUser(user).map((l) => l.href)).toEqual([
      '/dashboard',
      '/events',
      '/certificates/templates',
      '/certificates/defaults',
    ]);
    expect(filterSidebarNavForUser(user).map((l) => l.href)).not.toContain('/sessions');
  });
  it('member sees no identity nav', () => {
    const user: UserDto = {
      id: '2',
      username: 'm',
      email: 'm@example.com',
      firstName: 'M',
      lastName: 'M',
      roles: ['WEBLAB'],
      groups: ['/UYELER/ARGE/WEBLAB'],
    };
    expect(filterSidebarNavForUser(user)).toEqual([]);
  });
  it('GECEKODU member sees the event workspace they can operate', () => {
    const user: UserDto = {
      id: '7',
      username: 'gece',
      email: 'gece@example.com',
      firstName: 'Gece',
      lastName: 'Kodu',
      roles: [],
      groups: ['/UYELER/ORGANIZASYON/GECEKODU'],
    };
    expect(filterSidebarNavForUser(user).map((link) => link.href)).toEqual(['/events']);
  });
  it('assigned door staff sees the door workspace without management links', () => {
    const user: UserDto = {
      id: '8',
      username: 'door',
      email: 'door@example.com',
      firstName: 'Door',
      lastName: 'Staff',
      roles: [],
      groups: ['/UYELER/ARGE/WEBLAB'],
    };
    expect(
      filterSidebarNavForUser(user, { hasDoorAssignment: true }).map((link) => link.href),
    ).toEqual(['/qr']);
  });
  it('member with url:create sees Kısa URL', () => {
    const user: UserDto = {
      id: '4',
      username: 'url',
      email: 'url@example.com',
      firstName: 'U',
      lastName: 'R',
      roles: ['url:create'],
      groups: ['/UYELER/ARGE/WEBLAB'],
    };
    expect(filterSidebarNavForUser(user).map((l) => l.href)).toEqual(['/dashboard', '/urls']);
  });
  it('users:read sees only the read-safe user area', () => {
    const user: UserDto = {
      id: '6',
      username: 'reader',
      email: 'reader@example.com',
      firstName: 'Read',
      lastName: 'Only',
      roles: ['users:read'],
      groups: ['/SERVICES/FORMS'],
    };
    expect(filterSidebarNavForUser(user).map((l) => l.href)).toEqual(['/users']);
  });
  it('Leader with only a legacy skylapp role does not see Kısa URL', () => {
    const user: UserDto = {
      id: '5',
      username: 'lead',
      email: 'lead@example.com',
      firstName: 'L',
      lastName: 'E',
      roles: ['skylapp:access'],
      groups: ['/UYELER/ARGE/WEBLAB/LIDERLER'],
    };
    expect(filterSidebarNavForUser(user).map((l) => l.href)).not.toContain('/urls');
  });
});

describe('UserCardView', () => {
  it('renders a GET user payload that omits empty groups, roles, phone, and uid', () => {
    const card = {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
    };
    render(<UserCardView card={card} canReadFull />);
    expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByText('Grup yok')).toBeInTheDocument();
    expect(screen.getByText('Gruptan gelen rol yok')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Doğrudan roller' })).not.toBeInTheDocument();
    expect(screen.getByText('Telefon').closest('div')).toHaveTextContent('—');
    expect(screen.queryByText('Öğrenci kartı UID')).not.toBeInTheDocument();
  });

  it('leaves the phone out of a card core shares without user.readFull', () => {
    render(
      <UserCardView
        card={{
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
        }}
      />,
    );
    expect(screen.queryByText('Telefon')).not.toBeInTheDocument();
  });

  it('lists direct roles as to be moved, with no way to add one', () => {
    const onRemoveRole = jest.fn();
    render(
      <UserCardView
        card={{
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
          extraRoles: [{ clientId: 'forms', role: 'forms:admin' }],
        }}
        onRemoveRole={onRemoveRole}
      />,
    );
    expect(screen.getByRole('list', { name: 'Doğrudan roller' })).toHaveTextContent('forms:admin');
    expect(screen.getByText('Doğrudan rol: 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rol ekle' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kaldır' })).toBeInTheDocument();
  });

  it('keeps inherited and extra client roles distinct', () => {
    render(
      <UserCardView
        card={{
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
          groups: [{ id: 'g', name: 'WEBLAB', path: '/UYELER/ARGE/WEBLAB' }],
          inheritedRoles: [{ clientId: 'skyforms', role: 'skyforms:access' }],
          extraRoles: [{ clientId: 'skyforms', role: 'skyforms:form:manage' }],
        }}
      />,
    );
    const inherited = screen.getByRole('list', { name: 'Gruptan gelen roller' });
    const direct = screen.getByRole('list', { name: 'Doğrudan roller' });
    expect(inherited).toHaveTextContent('skyforms:access');
    expect(inherited).not.toHaveTextContent('skyforms:form:manage');
    expect(direct).toHaveTextContent('skyforms:form:manage');
  });

  it('shows school email when present', () => {
    render(
      <UserCardView
        card={{
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
          schoolEmail: 'ada@std.yildiz.edu.tr',
          groups: [],
          inheritedRoles: [],
          extraRoles: [],
        }}
      />,
    );
    expect(screen.getByText('ada@std.yildiz.edu.tr')).toBeInTheDocument();
  });

  it('names empty groups and roles', () => {
    render(
      <UserCardView
        card={{
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
          groups: [],
          inheritedRoles: [],
          extraRoles: [],
        }}
      />,
    );
    expect(screen.getByText('Grup yok')).toBeInTheDocument();
    expect(screen.getByText('Gruptan gelen rol yok')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Doğrudan roller' })).not.toBeInTheDocument();
  });

  it('shows sky number when present', () => {
    render(
      <UserCardView
        card={{
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
          skyNumber: 'SKY-0000001',
          groups: [],
          inheritedRoles: [],
          extraRoles: [],
        }}
      />,
    );
    expect(screen.getByText('SKY-0000001')).toBeInTheDocument();
  });

  it('shows university, faculty, department, LinkedIn, phone, and student card uid', () => {
    render(
      <UserCardView
        card={{
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
          skyNumber: 'SKY-0000001',
          university: 'YTÜ',
          faculty: 'Elektrik-Elektronik',
          department: 'Bilgisayar',
          linkedin: 'https://linkedin.com/in/ada',
          phone: '5551112233',
          studentCardUid: 'AABBCCDDEEFF',
          groups: [],
          inheritedRoles: [],
          extraRoles: [],
        }}
        canReadFull
      />,
    );
    expect(screen.getByText('YTÜ')).toBeInTheDocument();
    expect(screen.getByText('Elektrik-Elektronik')).toBeInTheDocument();
    expect(screen.getByText('Bilgisayar')).toBeInTheDocument();
    expect(screen.getByText('https://linkedin.com/in/ada')).toBeInTheDocument();
    expect(screen.getByText('5551112233')).toBeInTheDocument();
    expect(screen.getByText('AABBCCDDEEFF')).toBeInTheDocument();
  });

  it('lets privileged save profile fields without uid, sky number, or password', async () => {
    const onSaveProfile = jest.fn();
    render(
      <UserCardView
        card={{
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
          skyNumber: 'SKY-0000001',
          university: 'YTÜ',
          studentCardUid: 'AABBCCDDEEFF',
          groups: [],
          inheritedRoles: [],
          extraRoles: [],
        }}
        canEditProfile
        onSaveProfile={onSaveProfile}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Düzenle' }));
    const university = screen.getByLabelText('Üniversite');
    await userEvent.clear(university);
    await userEvent.type(university, 'İTÜ');
    expect(screen.getByLabelText('Öğrenci kartı UID')).toHaveAttribute('readOnly');
    await userEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(onSaveProfile).toHaveBeenCalledTimes(1);
    const patch = onSaveProfile.mock.calls[0][0];
    expect(patch).toMatchObject({ university: 'İTÜ' });
    expect(patch).not.toHaveProperty('skyNumber');
    expect(patch).not.toHaveProperty('studentCardUid');
    expect(patch).not.toHaveProperty('password');
    expect(patch).not.toHaveProperty('phone');
  });

  it('clears phone only when the operator emptied a value that was on the card', async () => {
    const onSaveProfile = jest.fn();
    render(
      <UserCardView
        card={{
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
          phone: '5551112233',
          groups: [],
          inheritedRoles: [],
          extraRoles: [],
        }}
        canEditProfile
        onSaveProfile={onSaveProfile}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Düzenle' }));
    await userEvent.clear(screen.getByLabelText('Telefon'));
    await userEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(onSaveProfile).toHaveBeenCalledWith(expect.objectContaining({ phone: '' }));
  });

  it('sends an empty first name so an operator can clear it', async () => {
    const onSaveProfile = jest.fn();
    render(
      <UserCardView
        card={{
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
          groups: [],
          inheritedRoles: [],
          extraRoles: [],
        }}
        canEditProfile
        onSaveProfile={onSaveProfile}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Düzenle' }));
    await userEvent.clear(screen.getByLabelText('Ad'));
    await userEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(onSaveProfile).toHaveBeenCalledWith(expect.objectContaining({ firstName: '' }));
  });
});
