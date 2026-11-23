import { DataList } from '@skylab-kulubu/skylcn-ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MenuItem } from '@skylab-kulubu/skylcn-ui';
import {
  ListFooter,
  ListPage,
  RowMenu,
  SelectionBar,
  SummaryStrip,
  selectionColumn,
  useRowSelection,
} from '@/components/chrome/ListPage';

describe('ListPage', () => {
  it('lays out the title, commands, summary, toolbar, list and footer in order', () => {
    render(
      <ListPage
        title="Duyurular"
        commands={<div>komutlar</div>}
        summary={<div>özet</div>}
        toolbar={<div>araç</div>}
        footer={<div>alt</div>}
      >
        <div>liste</div>
      </ListPage>,
    );
    expect(screen.getByRole('heading', { name: 'Duyurular' })).toBeInTheDocument();
    const order = ['komutlar', 'özet', 'araç', 'liste', 'alt'].map((text) =>
      screen.getByText(text),
    );
    for (let i = 1; i < order.length; i++) {
      expect(
        order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });
});

describe('SummaryStrip', () => {
  it('turns the list to a card’s view and says which one is on', async () => {
    const pointer = userEvent.setup();
    const pick = jest.fn();
    render(
      <SummaryStrip
        items={[
          { key: 'all', label: 'Duyuru', value: 12, active: true, onSelect: jest.fn() },
          { key: 'f', label: 'Öne çıkan', value: 3, onSelect: pick },
          { key: 'n', label: 'Bu ay', value: 2 },
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: /Duyuru\s*12/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await pointer.click(screen.getByRole('button', { name: /Öne çıkan\s*3/ }));
    expect(pick).toHaveBeenCalledTimes(1);
    // A card that only says is not a button
    expect(screen.queryByRole('button', { name: /Bu ay/ })).not.toBeInTheDocument();
  });
});

describe('ListFooter', () => {
  it('counts the rows shown and pages only when there is more than one page', () => {
    const { rerender } = render(
      <ListFooter total={120} page={2} totalPages={3} pageSize={50} onPage={jest.fn()} />,
    );
    expect(screen.getByText('51–100 / 120')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    rerender(<ListFooter total={7} page={1} totalPages={1} onPage={jest.fn()} noun="duyuru" />);
    expect(screen.getByText('7 duyuru')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('says nothing under an empty list', () => {
    const { container } = render(
      <ListFooter total={0} page={1} totalPages={1} onPage={jest.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

type Row = { id: string; name: string };
const ROWS: Row[] = [
  { id: 'a', name: 'Ayşe' },
  { id: 'b', name: 'Bora' },
];

function Picked({ view = 'all' }: { view?: string }) {
  const selection = useRowSelection(view);
  return (
    <>
      <p>{selection.count} seçili</p>
      <DataList
        columns={[
          selectionColumn<Row>({
            selection,
            pageIds: ROWS.map((row) => row.id),
            idOf: (row) => row.id,
            nameOf: (row) => row.name,
          }),
          { id: 'name', width: 'minmax(0,1fr)', header: 'Ad', cell: (row: Row) => row.name },
        ]}
        rows={ROWS}
        getRowId={(row) => row.id}
      />
    </>
  );
}

describe('row selection', () => {
  it('chooses rows one by one and all on the page from the header', async () => {
    const pointer = userEvent.setup();
    render(<Picked />);
    await pointer.click(screen.getByRole('checkbox', { name: 'Ayşe seç' }));
    expect(screen.getByText('1 seçili')).toBeInTheDocument();
    expect(
      (screen.getByRole('checkbox', { name: 'Sayfadakilerin hepsini seç' }) as HTMLInputElement)
        .indeterminate,
    ).toBe(true);
    await pointer.click(screen.getByRole('checkbox', { name: 'Sayfadakilerin hepsini seç' }));
    expect(screen.getByText('2 seçili')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Sayfadakilerin hepsini seç' })).toBeChecked();
    await pointer.click(screen.getByRole('checkbox', { name: 'Sayfadakilerin hepsini seç' }));
    expect(screen.getByText('0 seçili')).toBeInTheDocument();
  });
});

describe('SelectionBar and RowMenu', () => {
  it('says how many rows are chosen and drops the choice', async () => {
    const pointer = userEvent.setup();
    const clear = jest.fn();
    const mail = jest.fn();
    render(
      <SelectionBar count={3} onClear={clear}>
        <button type="button" onClick={mail}>
          E-posta
        </button>
      </SelectionBar>,
    );
    expect(screen.getByText(/3/)).toBeInTheDocument();
    await pointer.click(screen.getByRole('button', { name: 'E-posta' }));
    expect(mail).toHaveBeenCalledTimes(1);
  });

  it('keeps a row’s other actions behind a named "⋯"', async () => {
    const pointer = userEvent.setup();
    const share = jest.fn();
    render(
      <RowMenu rowName="Bahar şenliği">
        <MenuItem onClick={share}>Paylaş</MenuItem>
      </RowMenu>,
    );
    await pointer.click(screen.getByRole('button', { name: 'Bahar şenliği: eylemler' }));
    await pointer.click(await screen.findByRole('menuitem', { name: 'Paylaş' }));
    expect(share).toHaveBeenCalledTimes(1);
  });
});

describe('row selection and the list view', () => {
  it('drops the choice when the search, view or page changes', async () => {
    const pointer = userEvent.setup();
    const { rerender } = render(<Picked view="all" />);
    await pointer.click(screen.getByRole('checkbox', { name: 'Ayşe seç' }));
    expect(screen.getByText('1 seçili')).toBeInTheDocument();
    rerender(<Picked view="featured" />);
    expect(screen.getByText('0 seçili')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Ayşe seç' })).not.toBeChecked();
  });
});
