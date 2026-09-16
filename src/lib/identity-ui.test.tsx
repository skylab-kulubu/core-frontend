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
      '/sessions',
      '/event-types',
      '/qr',
      '/competitors',
      '/media',
      '/urls',
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
      '/dashboard',
      '/events',
      '/sessions',
      '/qr',
      '/competitors',
      '/media',
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
    expect(screen.getByText('Miras client rolleri').parentElement).toHaveTextContent(
      'skyforms:access',
    );
    expect(screen.getByText('Ekstra client rolleri').parentElement).toHaveTextContent(
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
});
