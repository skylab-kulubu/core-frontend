import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { UserMenu } from '@/components/layout/UserMenu';
import type { UserDto } from '@/types/api';

const mockPerformClientLogout = jest.fn();

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

async function openMenu(editSites?: Array<{ href: string; label: string }>) {
  const pointer = userEvent.setup();
  render(<UserMenu user={user} editSites={editSites} />);
  await pointer.click(screen.getByRole('button', { name: 'Hesap: Deniz Aydın' }));
  return pointer;
}

describe('UserMenu', () => {
  beforeEach(() => jest.clearAllMocks());

  it('draws the account button: avatar, the name and a chevron', () => {
    render(<UserMenu user={user} />);
    const button = screen.getByRole('button', { name: 'Hesap: Deniz Aydın' });
    expect(button).toHaveTextContent('DADeniz Aydın');
    expect(button).toHaveClass('size-9', 'rounded-full', 'md:border-border');
    expect(button.querySelector('[data-slot="avatar"]')).toHaveClass('size-8');
    expect(button.querySelector('svg.lucide-chevron-down')).toBeInTheDocument();
    // The name is for desktop; phones show the avatar alone
    expect(screen.getByText('Deniz Aydın')).toHaveClass(
      'hidden',
      'md:inline',
      'max-w-[16ch]',
      'truncate',
    );
  });

  it('names the person, their e-mail and role at the top of the menu', async () => {
    await openMenu();
    const menu = await screen.findByRole('menu');
    expect(menu).toHaveTextContent('Deniz Aydın');
    expect(menu).toHaveTextContent('deniz@example.com');
    expect(menu).toHaveTextContent('YÖNETİM');
  });

  it('links the account center', async () => {
    await openMenu();
    expect(await screen.findByRole('menuitem', { name: 'Hesap merkezi' })).toHaveAttribute(
      'href',
      'https://my.yildizskylab.com',
    );
  });

  it('signs out', async () => {
    const pointer = await openMenu();
    await pointer.click(await screen.findByRole('menuitem', { name: 'Çıkış yap' }));
    expect(mockPerformClientLogout).toHaveBeenCalledTimes(1);
  });

  it('offers to edit only the sites the person may edit', async () => {
    const pointer = await openMenu([
      { href: 'https://artlab.yildizskylab.com/api/signin', label: 'ARTLAB' },
    ]);
    await pointer.click(await screen.findByRole('menuitem', { name: 'Siteyi düzenle' }));
    expect(await screen.findByRole('menuitem', { name: 'ARTLAB' })).toHaveAttribute(
      'href',
      'https://artlab.yildizskylab.com/api/signin',
    );
  });

  it('shows no site editing to a person who edits no site', async () => {
    await openMenu([]);
    await screen.findByRole('menuitem', { name: 'Hesap merkezi' });
    expect(screen.queryByRole('menuitem', { name: 'Siteyi düzenle' })).not.toBeInTheDocument();
  });
});
