import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AdminSearch } from '@/components/layout/AdminSearch';
import type { SidebarNavigationContext } from '@/lib/navigation/sidebar-nav';
import type { UserDto } from '@/types/api';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const user: UserDto = {
  id: '1',
  username: 'deniz',
  email: 'deniz@example.com',
  firstName: 'Deniz',
  lastName: 'Aydın',
  roles: [],
  groups: ['/UYELER/YK'],
};

function renderSearch(who: UserDto = user, navigationContext: SidebarNavigationContext = {}) {
  return render(<AdminSearch user={who} navigationContext={navigationContext} />);
}

describe('AdminSearch', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens with the keyboard, filters destinations and navigates', async () => {
    const keyboard = userEvent.setup();
    renderSearch();
    await keyboard.keyboard('{Meta>}k{/Meta}');
    const search = await screen.findByRole('combobox', { name: 'Sayfa ara' });
    expect(search).toHaveFocus();
    await keyboard.type(search, 'kapı');
    await keyboard.click(screen.getByRole('option', { name: /Kapı/ }));
    expect(push).toHaveBeenCalledWith('/qr');
    expect(screen.queryByRole('combobox', { name: 'Sayfa ara' })).not.toBeInTheDocument();
  });

  it('does not steal Ctrl+K from a form field', async () => {
    const keyboard = userEvent.setup();
    render(
      <>
        <input aria-label="Not" />
        <AdminSearch user={user} navigationContext={{}} />
      </>,
    );
    await keyboard.click(screen.getByRole('textbox', { name: 'Not' }));
    await keyboard.keyboard('{Control>}k{/Control}');
    expect(screen.queryByRole('combobox', { name: 'Sayfa ara' })).not.toBeInTheDocument();
  });

  it('closes with Escape', async () => {
    const keyboard = userEvent.setup();
    renderSearch();
    await keyboard.click(screen.getByRole('button', { name: 'Hızlı git' }));
    expect(await screen.findByRole('combobox', { name: 'Sayfa ara' })).toBeInTheDocument();
    await keyboard.keyboard('{Escape}');
    expect(screen.queryByRole('combobox', { name: 'Sayfa ara' })).not.toBeInTheDocument();
  });

  it('offers only the door to door staff', async () => {
    const keyboard = userEvent.setup();
    renderSearch({ ...user, groups: ['/UYELER/ARGE/WEBLAB'] }, { hasDoorAssignment: true });
    await keyboard.click(screen.getByRole('button', { name: 'Hızlı git' }));
    expect(await screen.findByRole('option', { name: /Kapı/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Kullanıcılar/ })).not.toBeInTheDocument();
  });

  it('announces the highlighted destination through combobox semantics', async () => {
    const keyboard = userEvent.setup();
    renderSearch();
    await keyboard.click(screen.getByRole('button', { name: 'Hızlı git' }));
    const search = await screen.findByRole('combobox', { name: 'Sayfa ara' });
    const options = screen.getAllByRole('option');
    expect(search).toHaveAttribute('aria-activedescendant', options[0].id);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await keyboard.type(search, '{ArrowDown}');
    expect(search).toHaveAttribute('aria-activedescendant', options[1].id);
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
  });
});
