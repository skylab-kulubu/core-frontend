import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { Sidebar } from '@/components/layout/Sidebar';
import type { UserDto } from '@/types/api';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
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

describe('CommandPalette', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens with the keyboard, filters allowed destinations, and navigates', async () => {
    const keyboard = userEvent.setup();
    render(<CommandPalette user={user} />);
    const pageRoot = screen.getByRole('button', { name: 'Hızlı git' }).parentElement as HTMLElement;
    await keyboard.keyboard('{Meta>}k{/Meta}');
    const dialog = screen.getByRole('dialog', { name: 'Hızlı git' });
    expect(dialog).toBeInTheDocument();
    expect(pageRoot.inert).toBe(true);
    const search = screen.getByRole('combobox', { name: 'Sayfa ara' });
    expect(search).toHaveFocus();
    await keyboard.type(search, 'kapı');
    await keyboard.click(screen.getByRole('option', { name: /Kapı/ }));
    expect(push).toHaveBeenCalledWith('/qr');
    expect(screen.queryByRole('dialog', { name: 'Hızlı git' })).not.toBeInTheDocument();
    expect(pageRoot.inert).not.toBe(true);
  });

  it('does not steal command-k from a form field', async () => {
    const keyboard = userEvent.setup();
    render(
      <>
        <input aria-label="Not" />
        <CommandPalette user={user} />
      </>,
    );
    await keyboard.click(screen.getByRole('textbox', { name: 'Not' }));
    await keyboard.keyboard('{Control>}k{/Control}');
    expect(screen.queryByRole('dialog', { name: 'Hızlı git' })).not.toBeInTheDocument();
  });

  it('closes with Escape when the global shortcut is disabled', async () => {
    const keyboard = userEvent.setup();
    render(<CommandPalette user={user} enableShortcut={false} />);
    await keyboard.click(screen.getByRole('button', { name: 'Hızlı git' }));
    expect(screen.getByRole('dialog', { name: 'Hızlı git' })).toBeInTheDocument();
    await keyboard.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Hızlı git' })).not.toBeInTheDocument();
  });

  it('closes only the topmost layer when opened over the mobile sidebar', async () => {
    const keyboard = userEvent.setup();
    function Harness() {
      const [menuOpen, setMenuOpen] = React.useState(true);
      return (
        <>
          <Sidebar
            prefetchedUser={user}
            isMobileOpen={menuOpen}
            onMobileClose={() => setMenuOpen(false)}
          />
          <CommandPalette user={user} enableShortcut={false} />
        </>
      );
    }
    render(<Harness />);
    await keyboard.click(screen.getByRole('button', { name: 'Hızlı git' }));
    expect(screen.getByRole('dialog', { name: 'Ana menü' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Hızlı git' })).toBeInTheDocument();

    await keyboard.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Hızlı git' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Ana menü' })).toBeInTheDocument();

    await keyboard.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Ana menü' })).not.toBeInTheDocument();
  });

  it('offers only the door destination to assigned door staff', async () => {
    const keyboard = userEvent.setup();
    render(
      <CommandPalette
        user={{ ...user, groups: ['/UYELER/ARGE/WEBLAB'] }}
        navigationContext={{ hasDoorAssignment: true }}
        enableShortcut={false}
      />,
    );

    await keyboard.click(screen.getByRole('button', { name: 'Hızlı git' }));

    expect(screen.getByRole('option', { name: /Kapı/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Kullanıcılar/ })).not.toBeInTheDocument();
  });

  it('announces keyboard selection through combobox semantics', async () => {
    const keyboard = userEvent.setup();
    render(<CommandPalette user={user} enableShortcut={false} />);
    await keyboard.click(screen.getByRole('button', { name: 'Hızlı git' }));
    const search = screen.getByRole('combobox', { name: 'Sayfa ara' });
    const options = screen.getAllByRole('option');
    expect(search).toHaveAttribute('aria-activedescendant', options[0].id);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    await keyboard.type(search, '{ArrowDown}');
    expect(search).toHaveAttribute('aria-activedescendant', options[1].id);
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
  });
});
