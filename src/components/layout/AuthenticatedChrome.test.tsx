import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AuthenticatedChrome } from '@/components/layout/AuthenticatedChrome';
import { eventsApi } from '@/lib/api/events';
import { ticketsApi } from '@/lib/api/tickets';
import type { UserDto } from '@/types/api';

jest.mock('@/lib/api/tickets', () => ({
  ticketsApi: { listDoorEvents: jest.fn() },
}));

jest.mock('@/lib/api/events', () => ({
  eventsApi: { get: jest.fn() },
}));

let currentPathname = '/dashboard';

jest.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

const user: UserDto = {
  id: '1',
  username: 'yk',
  email: 'yk@example.com',
  firstName: 'Y',
  lastName: 'K',
  roles: [],
  groups: ['/UYELER/YK'],
};

describe('AuthenticatedChrome', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentPathname = '/dashboard';
    window.localStorage.clear();
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([]);
  });

  it('closes the mobile menu when the viewport crosses into desktop', async () => {
    let onChange: ((event: MediaQueryListEvent) => void) | undefined;
    let desktop = false;
    window.matchMedia = jest.fn().mockImplementation(() => ({
      get matches() {
        return desktop;
      },
      media: '(min-width: 48rem)',
      addEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => {
        onChange = listener;
      },
      removeEventListener: jest.fn(),
    }));
    const pointer = userEvent.setup();
    render(
      <AuthenticatedChrome sidebarUser={user}>
        <p>İçerik</p>
      </AuthenticatedChrome>,
    );
    await pointer.click(screen.getByRole('button', { name: 'Menüyü aç' }));
    expect(screen.getByRole('dialog', { name: 'Gezinme' })).toBeInTheDocument();

    act(() => {
      desktop = true;
      onChange?.({ matches: true } as MediaQueryListEvent);
    });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Gezinme' })).not.toBeInTheDocument(),
    );
  });

  it('discovers door assignments and exposes the door workspace', async () => {
    const doorUser: UserDto = {
      ...user,
      id: 'door-1',
      username: 'door',
      email: 'door@example.com',
      groups: ['/UYELER/ARGE/WEBLAB'],
    };
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([{ id: 'event-1', name: 'Hack' }]);

    render(
      <AuthenticatedChrome sidebarUser={doorUser}>
        <p>İçerik</p>
      </AuthenticatedChrome>,
    );

    await waitFor(() => expect(screen.getByRole('link', { name: 'Kapı' })).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'Kullanıcılar' })).not.toBeInTheDocument();
  });

  it('restores and persists the desktop sidebar width preference', async () => {
    window.localStorage.setItem('skylab.admin.sidebar-collapsed', 'true');
    const pointer = userEvent.setup();
    render(
      <AuthenticatedChrome sidebarUser={user}>
        <p>İçerik</p>
      </AuthenticatedChrome>,
    );

    const expand = await screen.findByRole('button', { name: 'Kenar çubuğunu genişlet' });
    await pointer.click(expand);
    expect(window.localStorage.getItem('skylab.admin.sidebar-collapsed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Kenar çubuğunu daralt' })).toBeInTheDocument();
  });

  it('shows event-scoped navigation only for the current event capabilities', async () => {
    currentPathname = '/events/event-1';
    const leader = { ...user, groups: ['/UYELER/ARGE/WEBLAB/LIDERLER'] };
    (eventsApi.get as jest.Mock).mockResolvedValue({ id: 'event-1', ownerTeam: 'WEBLAB' });
    render(
      <AuthenticatedChrome sidebarUser={leader}>
        <p>İçerik</p>
      </AuthenticatedChrome>,
    );

    expect(await screen.findByRole('button', { name: 'Aktif Etkinlik' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Başvuranlar' })).toBeInTheDocument();
  });

  it('does not expose event tools to a leader from another owner team', async () => {
    currentPathname = '/events/event-2';
    const leader = { ...user, groups: ['/UYELER/ARGE/WEBLAB/LIDERLER'] };
    (eventsApi.get as jest.Mock).mockResolvedValue({ id: 'event-2', ownerTeam: 'SKYSEC' });
    render(
      <AuthenticatedChrome sidebarUser={leader}>
        <p>İçerik</p>
      </AuthenticatedChrome>,
    );

    await waitFor(() => expect(eventsApi.get).toHaveBeenCalledWith('event-2'));
    expect(screen.queryByRole('button', { name: 'Aktif Etkinlik' })).not.toBeInTheDocument();
  });
});
