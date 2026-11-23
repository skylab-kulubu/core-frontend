import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { SidePanel, panelNeighbours } from '@/components/chrome/SidePanel';

describe('SidePanel', () => {
  it('titles the row, links its own page and steps through rows with ↑/↓', async () => {
    const pointer = userEvent.setup();
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
      >
        <p>Ayrıntı</p>
      </SidePanel>,
    );
    expect(await screen.findByRole('dialog', { name: 'Bahar şenliği' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tam sayfa' })).toHaveAttribute(
      'href',
      '/announcements/bahar/edit',
    );
    await pointer.keyboard('{ArrowDown}');
    expect(next).toHaveBeenCalledTimes(1);
    await pointer.keyboard('{ArrowUp}');
    expect(prev).toHaveBeenCalledTimes(1);
    await pointer.click(screen.getByRole('button', { name: 'Sonraki' }));
    expect(next).toHaveBeenCalledTimes(2);
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
