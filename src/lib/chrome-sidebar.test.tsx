import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import type { UserDto } from '@/types/api';

let currentPathname = '/dashboard';
let currentSearch = '';

jest.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
  useSearchParams: () => new URLSearchParams(currentSearch),
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
  beforeEach(() => {
    currentPathname = '/dashboard';
    currentSearch = '';
    window.localStorage.clear();
  });

  it('shows identity, role, Özet, club footer without Place or waffle', () => {
    render(<Sidebar prefetchedUser={user} />);
    expect(screen.getAllByText('Yusuf Açmacı').length).toBeGreaterThan(0);
    expect(screen.getAllByText('YÖNETİM').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Özet/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Forms' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Mail' }).length).toBeGreaterThan(0);
    expect(screen.queryByText('Place')).not.toBeInTheDocument();
    expect(screen.queryByText('Yönetim')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Oturumlar' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Etkinlikler' })).toBeInTheDocument();
  });

  it('renders one-level disclosure groups with accessible state', () => {
    render(<Sidebar prefetchedUser={user} />);
    expect(screen.getByRole('navigation', { name: 'Ana navigasyon' })).toBeInTheDocument();
    const events = screen.getByRole('button', { name: 'Etkinlikler' });
    expect(events).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Takvim' })).toHaveAttribute(
      'href',
      '/events?view=calendar',
    );
    expect(screen.getByRole('button', { name: 'Kulüp' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('marks only the matching events query destination as current', () => {
    currentPathname = '/events';
    currentSearch = 'view=calendar';
    render(<Sidebar prefetchedUser={user} />);
    expect(screen.getByRole('link', { name: 'Takvim' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Tümü' })).not.toHaveAttribute('aria-current');
  });

  it('adds an expanded contextual workspace on event routes', () => {
    currentPathname = '/events/event-1';
    render(
      <Sidebar
        prefetchedUser={user}
        navigationContext={{
          activeEvent: {
            id: 'event-1',
            canSeeParticipants: true,
            canSeeCompetitors: true,
            canUseDoor: true,
          },
        }}
      />,
    );

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

  it('does not treat the event creation route as an active event', () => {
    currentPathname = '/events/new';
    render(<Sidebar prefetchedUser={user} />);
    expect(screen.queryByRole('button', { name: 'Aktif Etkinlik' })).not.toBeInTheDocument();
  });

  it('remembers disclosure choices between mounts', async () => {
    const pointer = userEvent.setup();
    const first = render(<Sidebar prefetchedUser={user} />);
    await pointer.click(screen.getByRole('button', { name: 'Kulüp' }));
    expect(window.localStorage.getItem('skylab.admin.nav-group.club')).toBe('true');
    first.unmount();

    render(<Sidebar prefetchedUser={user} />);
    expect(screen.getByRole('button', { name: 'Kulüp' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('provides labeled navigation in the collapsed desktop rail', async () => {
    const pointer = userEvent.setup();
    const onCollapsedChange = jest.fn();
    render(
      <Sidebar
        prefetchedUser={user}
        isDesktopCollapsed
        onDesktopCollapsedChange={onCollapsedChange}
      />,
    );
    expect(screen.getByRole('link', { name: 'Özet' })).toHaveAttribute('title', 'Özet');
    await pointer.click(screen.getByRole('button', { name: 'Menüyü genişlet' }));
    expect(onCollapsedChange).toHaveBeenCalledWith(false);
  });

  it('treats the mobile sidebar as a focus-managed dialog', async () => {
    const keyboard = userEvent.setup();
    function Harness() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Menü aç
          </button>
          <Sidebar prefetchedUser={user} isMobileOpen={open} onMobileClose={() => setOpen(false)} />
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Menü aç' });
    await keyboard.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Ana menü' });
    expect(within(dialog).getByRole('button', { name: 'Menüyü kapat' })).toHaveFocus();
    await keyboard.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Ana menü' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
