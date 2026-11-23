import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Download, Plus, RefreshCw, Trash2, Mail, Columns3, Copy, Share } from 'lucide-react';
import React from 'react';
import { CommandBar, CommandMenu } from '@/components/chrome/CommandBar';

describe('CommandBar', () => {
  it('writes the main command first, as a link when it has an address', () => {
    render(
      <CommandBar
        primary={{ key: 'new', label: 'Duyuru ekle', icon: Plus, href: '/announcements/new' }}
        commands={[{ key: 'refresh', label: 'Yenile', icon: RefreshCw, onSelect: jest.fn() }]}
      />,
    );
    const bar = screen.getByRole('toolbar', { name: 'Komutlar' });
    const links = within(bar).getAllByRole('link');
    expect(links[0]).toHaveTextContent('Duyuru ekle');
    expect(links[0]).toHaveAttribute('href', '/announcements/new');
    expect(within(bar).getByRole('button', { name: 'Yenile' })).toBeInTheDocument();
  });

  it('keeps four written commands and puts the rest in "⋯"', async () => {
    const pointer = userEvent.setup();
    const remove = jest.fn();
    render(
      <CommandBar
        commands={[
          { key: 'a', label: 'Yenile', icon: RefreshCw, onSelect: jest.fn() },
          { key: 'b', label: 'Dışa aktar', icon: Download, onSelect: jest.fn() },
          { key: 'c', label: 'E-posta', icon: Mail, onSelect: jest.fn() },
          { key: 'd', label: 'Sütunlar', icon: Columns3, onSelect: jest.fn() },
          { key: 'e', label: 'Kopyala', icon: Copy, onSelect: jest.fn() },
          { key: 'f', label: 'Sil', icon: Trash2, onSelect: remove, destructive: true },
        ]}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Kopyala' })).not.toBeInTheDocument();
    // The wide bar's "⋯" holds the fifth on; the phone's holds every one
    const [wide] = screen.getAllByRole('button', { name: 'Diğer komutlar' });
    await pointer.click(wide);
    const menu = await screen.findByRole('menu');
    expect(within(menu).queryByRole('menuitem', { name: 'Yenile' })).not.toBeInTheDocument();
    await pointer.click(within(menu).getByRole('menuitem', { name: 'Sil' }));
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('turns into the bulk bar while rows are chosen', async () => {
    const pointer = userEvent.setup();
    const mail = jest.fn();
    const clear = jest.fn();
    render(
      <CommandBar
        primary={{ key: 'new', label: 'Kişi ekle', icon: Plus, onSelect: jest.fn() }}
        selection={{
          count: 3,
          onClear: clear,
          commands: [{ key: 'mail', label: 'E-posta', icon: Mail, onSelect: mail }],
        }}
      />,
    );
    expect(screen.getByText(/3/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kişi ekle' })).not.toBeInTheDocument();
    await pointer.click(screen.getByRole('button', { name: 'E-posta' }));
    expect(mail).toHaveBeenCalledTimes(1);
  });

  it('draws nothing without commands', () => {
    const { container } = render(<CommandBar />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('CommandMenu', () => {
  it('names a row’s menu and runs its commands', async () => {
    const pointer = userEvent.setup();
    const share = jest.fn();
    render(
      <CommandMenu
        label="Bahar şenliği: eylemler"
        commands={[{ key: 's', label: 'Paylaş', icon: Share, onSelect: share }]}
      />,
    );
    await pointer.click(screen.getByRole('button', { name: 'Bahar şenliği: eylemler' }));
    await pointer.click(await screen.findByRole('menuitem', { name: 'Paylaş' }));
    expect(share).toHaveBeenCalledTimes(1);
  });
});
