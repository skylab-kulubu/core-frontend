import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ColumnPicker, useColumnChoice, type ColumnChoice } from '@/components/chrome/ColumnPicker';

const COLUMNS: ColumnChoice[] = [
  { id: 'name', label: 'Ad', fixed: true },
  { id: 'author', label: 'Yazar' },
  { id: 'tags', label: 'Etiketler', hidden: true },
];

function Picker() {
  const choice = useColumnChoice('test.columns', COLUMNS);
  return (
    <>
      <p>
        {COLUMNS.filter((column) => choice.isShown(column.id))
          .map((c) => c.id)
          .join(',')}
      </p>
      <ColumnPicker columns={COLUMNS} isShown={choice.isShown} onToggle={choice.toggle} />
    </>
  );
}

describe('ColumnPicker', () => {
  beforeEach(() => window.localStorage.clear());

  it('offers the optional columns and remembers the choice in this browser', async () => {
    const pointer = userEvent.setup();
    const first = render(<Picker />);
    expect(screen.getByText('name,author')).toBeInTheDocument();
    await pointer.click(screen.getByRole('button', { name: 'Sütunlar' }));
    expect(screen.queryByRole('menuitemcheckbox', { name: 'Ad' })).not.toBeInTheDocument();
    await pointer.click(await screen.findByRole('menuitemcheckbox', { name: 'Etiketler' }));
    expect(screen.getByText('name,author,tags')).toBeInTheDocument();
    first.unmount();

    render(<Picker />);
    expect(await screen.findByText('name,author,tags')).toBeInTheDocument();
  });
});

function InlinePicker() {
  // Built on each draw, as a page with a conditional column would
  const columns: ColumnChoice[] = [
    { id: 'name', label: 'Ad', fixed: true },
    { id: 'author', label: 'Yazar' },
  ];
  const choice = useColumnChoice('test.inline', columns);
  return <p>{choice.isShown('author') ? 'yazar açık' : 'yazar kapalı'}</p>;
}

describe('useColumnChoice', () => {
  it('settles with a column list built on each draw and a saved choice', async () => {
    window.localStorage.setItem('test.inline', JSON.stringify(['name']));
    render(<InlinePicker />);
    expect(await screen.findByText('yazar kapalı')).toBeInTheDocument();
  });
});
