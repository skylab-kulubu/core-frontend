import {
  MenuItem,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@skylab-kulubu/skylcn-ui';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { SidePanel, panelNeighbours } from '@/components/chrome/SidePanel';

function renderPanel(props: Partial<React.ComponentProps<typeof SidePanel>> = {}) {
  const prev = jest.fn();
  const next = jest.fn();
  render(
    <SidePanel
      open
      onClose={jest.fn()}
      title="Bahar şenliği"
      href="/announcements/bahar/edit"
      onPrev={prev}
      onNext={next}
      {...props}
    >
      <button type="button">Ayrıntı</button>
      <DropdownMenu>
        <DropdownMenuTrigger>Menü</DropdownMenuTrigger>
        <DropdownMenuContent>
          <MenuItem>Bir</MenuItem>
          <MenuItem>İki</MenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input aria-label="Not" />
    </SidePanel>,
  );
  return { prev, next };
}

describe('SidePanel', () => {
  it('titles the row, links its own page and steps through rows with ↑/↓ from the panel', async () => {
    const pointer = userEvent.setup();
    const { prev, next } = renderPanel();
    expect(await screen.findByRole('dialog', { name: 'Bahar şenliği' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tam sayfa' })).toHaveAttribute(
      'href',
      '/announcements/bahar/edit',
    );
    screen.getByRole('button', { name: 'Ayrıntı' }).focus();
    await pointer.keyboard('{ArrowDown}');
    expect(next).toHaveBeenCalledTimes(1);
    await pointer.keyboard('{ArrowUp}');
    expect(prev).toHaveBeenCalledTimes(1);
    await pointer.click(screen.getByRole('button', { name: 'Sonraki' }));
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('leaves the arrows to a field, a menu and the page outside the panel', async () => {
    const pointer = userEvent.setup();
    const { next } = renderPanel();
    await screen.findByRole('dialog', { name: 'Bahar şenliği' });
    await pointer.click(screen.getByLabelText('Not'));
    await pointer.keyboard('{ArrowDown}');
    await pointer.click(screen.getByRole('button', { name: 'Menü' }));
    const menu = await screen.findByRole('menu');
    within(menu).getAllByRole('menuitem')[0].focus();
    await pointer.keyboard('{ArrowDown}');
    expect(next).not.toHaveBeenCalled();
    await pointer.keyboard('{Escape}');
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(next).not.toHaveBeenCalled();
    outside.remove();
  });

  it('scrolls a long panel with the arrows before stepping', async () => {
    const pointer = userEvent.setup();
    const { next } = renderPanel();
    await screen.findByRole('dialog', { name: 'Bahar şenliği' });
    const button = screen.getByRole('button', { name: 'Ayrıntı' });
    const body = button.parentElement!.parentElement!;
    Object.defineProperty(body, 'scrollHeight', { configurable: true, value: 2000 });
    Object.defineProperty(body, 'clientHeight', { configurable: true, value: 500 });
    button.focus();
    await pointer.keyboard('{ArrowDown}');
    expect(next).not.toHaveBeenCalled();
  });

  it('asks before stepping away from unsaved typing, by button or key', async () => {
    const pointer = userEvent.setup();
    const { next, prev } = renderPanel({ dirty: true });
    await screen.findByRole('dialog', { name: 'Bahar şenliği' });
    await pointer.click(screen.getByRole('button', { name: 'Sonraki' }));
    const ask = await screen.findByRole('alertdialog', {
      name: 'Kaydedilmemiş değişiklikler silinsin mi?',
    });
    expect(next).not.toHaveBeenCalled();
    await pointer.click(within(ask).getByRole('button', { name: 'Değişiklikleri sil' }));
    expect(next).toHaveBeenCalledTimes(1);

    screen.getByRole('button', { name: 'Ayrıntı' }).focus();
    await pointer.keyboard('{ArrowUp}');
    expect(
      await screen.findByRole('alertdialog', { name: 'Kaydedilmemiş değişiklikler silinsin mi?' }),
    ).toBeInTheDocument();
    expect(prev).not.toHaveBeenCalled();
  });

  it('greys out the arrow at the end of the page', async () => {
    render(
      <SidePanel open onClose={jest.fn()} title="Son" onPrev={jest.fn()}>
        <p>Ayrıntı</p>
      </SidePanel>,
    );
    expect(await screen.findByRole('button', { name: 'Sonraki' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Önceki' })).toBeEnabled();
  });
});

describe('panelNeighbours', () => {
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const idOf = (row: { id: string }) => row.id;

  it('finds the open row and the ones beside it', () => {
    expect(panelNeighbours(rows, 'b', idOf)).toEqual({ row: { id: 'b' }, prev: 'a', next: 'c' });
    expect(panelNeighbours(rows, 'a', idOf)).toMatchObject({ prev: null, next: 'b' });
    expect(panelNeighbours(rows, 'c', idOf)).toMatchObject({ prev: 'b', next: null });
  });

  it('opens nothing for a row not on the page', () => {
    expect(panelNeighbours(rows, 'z', idOf)).toEqual({ row: null, prev: null, next: null });
    expect(panelNeighbours(rows, null, idOf).row).toBeNull();
  });
});
