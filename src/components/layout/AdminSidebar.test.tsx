import { AppShell } from '@skylab-kulubu/skylcn-ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import type { SidebarNavigationContext } from '@/lib/navigation/sidebar-nav';
import type { UserDto } from '@/types/api';

let currentPathname = '/dashboard';
let currentSearch = '';

jest.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
  useSearchParams: () => new URLSearchParams(currentSearch),
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

  it('shows the destinations the person’s groups allow', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: 'Özet' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: 'Etkinlikler' })).toHaveAttribute('href', '/events');
    expect(screen.queryByRole('link', { name: 'Oturumlar' })).not.toBeInTheDocument();
  });

  it('switches to the other club consoles from the brand', async () => {
    const pointer = userEvent.setup();
    renderSidebar();
    await pointer.click(screen.getByRole('button', { name: 'Kulüp konsolları' }));
    expect(await screen.findByRole('menuitem', { name: /Forms/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /İletişim/ })).toHaveTextContent(
      'E-posta ve bildirim gönderimi',
    );
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

  it('opens the day’s groups and keeps Ayarlar closed at first', () => {
    renderSidebar();
    expect(screen.getByRole('button', { name: 'Kişiler' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: 'İçerik' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Ayarlar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('opens Ayarlar on one of its pages', () => {
    currentPathname = '/seasons';
    renderSidebar();
    expect(screen.getByRole('button', { name: 'Ayarlar' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Sezonlar' })).toHaveAttribute('aria-current', 'page');
  });

  it('keeps Etkinlikler current on an event’s pages and lists none of them', () => {
    currentPathname = '/events/event-1/participants';
    renderSidebar();
    expect(screen.getByRole('link', { name: 'Etkinlikler' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.queryByRole('link', { name: 'Katılımcılar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Kapı' })).not.toBeInTheDocument();
  });

  it('keeps the account and the edited sites out of the sidebar (top bar menu)', () => {
    renderSidebar({ editSites: [{ href: 'https://artlab.example/api/signin', label: 'ARTLAB' }] });
    expect(screen.queryByRole('button', { name: 'Siteyi düzenle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deniz Aydın' })).not.toBeInTheDocument();
  });

  it('remembers a group the reader opened', async () => {
    const pointer = userEvent.setup();
    const first = renderSidebar();
    await pointer.click(screen.getByRole('button', { name: 'Ayarlar' }));
    expect(window.localStorage.getItem('skylab.admin.nav-group.settings')).toBe('true');
    first.unmount();

    renderSidebar();
    expect(screen.getByRole('button', { name: 'Ayarlar' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('keeps every destination named on the collapsed icon rail', () => {
    renderSidebar({}, { collapsed: true });
    expect(screen.getByRole('link', { name: 'Özet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Etkinlikler' })).toBeInTheDocument();
  });
});
