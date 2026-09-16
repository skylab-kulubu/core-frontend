import { render, screen } from '@testing-library/react';
import React from 'react';
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
  it('Privileged sees identity and scheduling', () => {
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
      '/users',
      '/groups',
      '/events',
      '/seasons',
      '/sessions',
      '/event-types',
      '/qr',
    ]);
  });
  it('Leader sees events sessions QR', () => {
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
      '/events',
      '/sessions',
      '/qr',
    ]);
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
    expect(screen.getByText('Miras client rolleri').parentElement).toHaveTextContent(
      'skyforms:access',
    );
    expect(screen.getByText('Ekstra client rolleri').parentElement).toHaveTextContent(
      'skyforms:form:manage',
    );
  });
});
