import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { ListToolbar } from '@/components/chrome/ListToolbar';

function Kept({ onQuery }: { onQuery: (q: string) => void }) {
  const [query, setQuery] = useState('');
  return (
    <>
      <ListToolbar
        query={query}
        onQuery={(q) => {
          setQuery(q);
          onQuery(q);
        }}
        commitDelay={250}
        placeholder="Ara"
        searchLabel="Duyuru ara"
      />
      <button type="button" onClick={() => setQuery('')}>
        temizle
      </button>
    </>
  );
}

describe('ListToolbar', () => {
  afterEach(() => jest.useRealTimers());

  it('answers each key in the box and hands the search on after a pause', async () => {
    jest.useFakeTimers();
    const pointer = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onQuery = jest.fn();
    render(<Kept onQuery={onQuery} />);
    await pointer.type(screen.getByRole('searchbox', { name: 'Duyuru ara' }), 'bahar');
    expect(screen.getByRole('searchbox', { name: 'Duyuru ara' })).toHaveValue('bahar');
    expect(onQuery).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(260));
    expect(onQuery).toHaveBeenCalledTimes(1);
    expect(onQuery).toHaveBeenLastCalledWith('bahar');
  });

  it('takes a search cleared from outside', async () => {
    const pointer = userEvent.setup();
    render(<Kept onQuery={jest.fn()} />);
    const box = screen.getByRole('searchbox', { name: 'Duyuru ara' });
    await pointer.type(box, 'x');
    await screen.findByDisplayValue('x');
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    await pointer.click(screen.getByRole('button', { name: 'temizle' }));
    expect(box).toHaveValue('');
  });

  it('shows the views with their counts and the sort', async () => {
    const pointer = userEvent.setup();
    const onView = jest.fn();
    const onSort = jest.fn();
    render(
      <ListToolbar
        query=""
        onQuery={jest.fn()}
        placeholder="Ara"
        searchLabel="Ara"
        views={[
          { value: 'all', label: 'Hepsi', count: 42 },
          { value: 'no', label: 'Gelmedi', count: 21 },
        ]}
        view="all"
        onView={onView}
        sort={{
          value: 'new',
          onChange: onSort,
          options: [
            { value: 'new', label: 'Yeni önce' },
            { value: 'name', label: 'Ada göre' },
          ],
        }}
      />,
    );
    await pointer.click(screen.getByRole('button', { name: /Gelmedi/ }));
    expect(onView).toHaveBeenCalledWith('no');
    await pointer.selectOptions(screen.getByRole('combobox', { name: 'Sıralama' }), 'name');
    expect(onSort).toHaveBeenCalledWith('name');
  });
});
