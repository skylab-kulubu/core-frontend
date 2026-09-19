import { render, screen } from '@testing-library/react';
import React from 'react';
import userEvent from '@testing-library/user-event';
import { isPrivileged } from '@/lib/auth/groups';
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
      '/users',
      '/groups',
      '/announcements',
      '/events',
      '/seasons',
      '/teams',
      '/qr',
      '/competitors',
      '/media',
      '/urls',
    ]);
    expect(filterSidebarNavForUser(user).map((l) => l.href)).not.toContain('/sessions');
  });
  it('Leader sees events and QR without a sessions page', () => {
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
      '/qr',
      '/competitors',
      '/media',
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
  it('Leader with skylapp:access sees Kısa URL', () => {
    const user: UserDto = {
      id: '5',
      username: 'lead',
      email: 'lead@example.com',
      firstName: 'L',
      lastName: 'E',
      roles: ['skylapp:access'],
      groups: ['/UYELER/ARGE/WEBLAB/LIDERLER'],
    };
    expect(filterSidebarNavForUser(user).map((l) => l.href)).toContain('/urls');
  });
});

describe('UserCardView', () => {
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
    expect(screen.getByText('Gruptan gelen roller').closest('section')).toHaveTextContent(
      'skyforms:access',
    );
    expect(screen.getByText('Ekstra roller').closest('section')).toHaveTextContent(
      'skyforms:form:manage',
    );
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
    expect(screen.getByText('Miras rol yok')).toBeInTheDocument();
    expect(screen.getByText('Ekstra rol yok')).toBeInTheDocument();
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
    const university = screen.getByLabelText('Üniversite');
    await userEvent.clear(university);
    await userEvent.type(university, 'İTÜ');
    await userEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(onSaveProfile).toHaveBeenCalledTimes(1);
    const patch = onSaveProfile.mock.calls[0][0];
    expect(patch).toMatchObject({ university: 'İTÜ' });
    expect(patch).not.toHaveProperty('skyNumber');
    expect(patch).not.toHaveProperty('studentCardUid');
    expect(patch).not.toHaveProperty('password');
    expect(patch).not.toHaveProperty('phone');
    expect(screen.getByLabelText('Öğrenci kartı UID')).toHaveAttribute('readOnly');
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
    await userEvent.clear(screen.getByLabelText('Telefon'));
    await userEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(onSaveProfile).toHaveBeenCalledWith(expect.objectContaining({ phone: '' }));
  });
});
