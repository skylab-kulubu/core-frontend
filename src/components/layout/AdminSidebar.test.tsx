import { AppShell } from '@skylab-kulubu/skylcn-ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import type { SidebarNavigationContext } from '@/lib/navigation/sidebar-nav';
import type { UserDto } from '@/types/api';

let currentPathname = '/dashboard';
let currentSearch = '';
const mockPerformClientLogout = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

jest.mock('@/lib/auth/client-logout', () => ({
  performClientLogout: () => mockPerformClientLogout(),
}));

const user: UserDto = {
  id: '1',
  username: 'deniz',
  email: 'deniz@example.com',
  firstName: 'deniz',
  lastName: 'aydın',
  roles: [],
  groups: ['/UYELER/YK'],
};

function renderSidebar(
  navigationContext: SidebarNavigationContext = {},
  { collapsed = false }: { collapsed?: boolean } = {},
) {
  return render(
    <AppShell
      storageKey={null}
      defaultCollapsed={collapsed}
      sidebar={<AdminSidebar user={user} navigationContext={navigationContext} />}
    >
      <p>İçerik</p>
    </AppShell>,
  );
}

describe('AdminSidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentPathname = '/dashboard';
    currentSearch = '';
    window.localStorage.clear();
  });

  it('signs out from the profile menu', async () => {
    const pointer = userEvent.setup();
    renderSidebar();
    await pointer.click(screen.getByRole('button', { name: 'Deniz Aydın' }));
    await pointer.click(await screen.findByRole('menuitem', { name: 'Çıkış yap' }));
    expect(mockPerformClientLogout).toHaveBeenCalledTimes(1);
  });

  it('shows the person, their role and the destinations their groups allow', () => {
    renderSidebar();
    expect(screen.getByText('Deniz Aydın')).toBeInTheDocument();
    expect(screen.getByText('YÖNETİM')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Özet' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('button', { name: 'Etkinlikler' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Oturumlar' })).not.toBeInTheDocument();
  });

  it('switches to the other club consoles from the brand', async () => {
    const pointer = userEvent.setup();
    renderSidebar();
    await pointer.click(screen.getByRole('button', { name: 'Kulüp konsolları' }));
    expect(await screen.findByRole('menuitem', { name: /Forms/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Mail/ })).toBeInTheDocument();
  });

  describe('playground link', () => {
    const original = process.env.NEXT_PUBLIC_INCLUDE_PLAYGROUND;

    afterEach(() => {
      if (original === undefined) delete process.env.NEXT_PUBLIC_INCLUDE_PLAYGROUND;
      else process.env.NEXT_PUBLIC_INCLUDE_PLAYGROUND = original;
    });

    it('is left out of the console switcher unless the playground is built in', async () => {
      delete process.env.NEXT_PUBLIC_INCLUDE_PLAYGROUND;
      const pointer = userEvent.setup();
      renderSidebar();
      await pointer.click(screen.getByRole('button', { name: 'Kulüp konsolları' }));
      expect(await screen.findByRole('menuitem', { name: /Forms/ })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /Playground/ })).not.toBeInTheDocument();
    });

    it('is offered when the image is built with the playground', async () => {
      process.env.NEXT_PUBLIC_INCLUDE_PLAYGROUND = 'true';
      const pointer = userEvent.setup();
      renderSidebar();
      await pointer.click(screen.getByRole('button', { name: 'Kulüp konsolları' }));
      expect(await screen.findByRole('menuitem', { name: /Playground/ })).toBeInTheDocument();
    });
  });

  it('opens the events group and keeps the others closed at first', () => {
    renderSidebar();
    expect(screen.getByRole('button', { name: 'Etkinlikler' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Takvim' })).toHaveAttribute(
      'href',
      '/events?view=calendar',
    );
    expect(screen.getByRole('button', { name: 'Kulüp' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('marks only the matching events query destination as current', () => {
    currentPathname = '/events';
    currentSearch = 'view=calendar';
    renderSidebar();
    expect(screen.getByRole('link', { name: 'Takvim' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Tümü' })).not.toHaveAttribute('aria-current');
  });

  it('adds an open workspace for the event whose pages are open', () => {
    currentPathname = '/events/event-1';
    renderSidebar({
      activeEvent: {
        id: 'event-1',
        canSeeParticipants: true,
        canSeeCompetitors: true,
        canUseDoor: true,
      },
    });
    expect(screen.getByRole('button', { name: 'Aktif Etkinlik' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Program' })).toHaveAttribute(
      'href',
      '/events/event-1#program',
    );
    expect(screen.getAllByRole('link', { name: 'Kapı' })).toHaveLength(2);
  });

  it('remembers a group the reader opened', async () => {
    const pointer = userEvent.setup();
    const first = renderSidebar();
    await pointer.click(screen.getByRole('button', { name: 'Kulüp' }));
    expect(window.localStorage.getItem('skylab.admin.nav-group.club')).toBe('true');
    first.unmount();

    renderSidebar();
    expect(screen.getByRole('button', { name: 'Kulüp' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps every destination named on the collapsed icon rail', () => {
    renderSidebar({}, { collapsed: true });
    expect(screen.getByRole('link', { name: 'Özet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Etkinlikler' })).toBeInTheDocument();
  });
});
