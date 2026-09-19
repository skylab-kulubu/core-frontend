import { render, screen } from '@testing-library/react';
import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { filterSidebarNavForUser } from '@/lib/navigation/sidebar-nav';
import type { UserDto } from '@/types/api';

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

const user: UserDto = {
  id: '1',
  username: 'yk',
  email: 'yk@example.com',
  firstName: 'yusuf',
  lastName: 'açmacı',
  roles: [],
  groups: ['/UYELER/YK'],
};

describe('Sidebar chrome', () => {
  it('shows identity, role, Özet, club footer without Place or waffle', () => {
    render(<Sidebar navLinks={filterSidebarNavForUser(user)} prefetchedUser={user} />);
    expect(screen.getAllByText('Yusuf Açmacı').length).toBeGreaterThan(0);
    expect(screen.getAllByText('YÖNETİM').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Özet/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Forms' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Mail' }).length).toBeGreaterThan(0);
    expect(screen.queryByText('Place')).not.toBeInTheDocument();
    expect(screen.queryByText('Yönetim')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Oturumlar' })).not.toBeInTheDocument();
    expect(
      screen
        .getAllByRole('link', { name: 'Etkinlikler' })
        .every((link) => link.getAttribute('href') === '/events'),
    ).toBe(true);
  });
});
