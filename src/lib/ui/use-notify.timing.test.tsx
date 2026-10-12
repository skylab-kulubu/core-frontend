import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProblemError } from '@/lib/api/core';
import { useNotify } from '@/lib/ui/use-notify';

// How long a toast stays is skylcn-ui's: the panel passes no timeout of its own.
function Buttons({ undo }: { undo: () => Promise<unknown> }) {
  const notify = useNotify();
  return (
    <>
      <button type="button" onClick={() => notify.success('Sezon kaydedildi')}>
        Kaydet
      </button>
      <button
        type="button"
        onClick={() => notify.undoable('Oturum silindi', undo, 'Oturum geri alındı')}
      >
        Sil
      </button>
    </>
  );
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

describe('useNotify toast durations come from skylcn-ui', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('a plain toast leaves after five seconds', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<Buttons undo={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(await screen.findByText('Sezon kaydedildi')).toBeInTheDocument();

    await advance(4_000);
    expect(screen.getByText('Sezon kaydedildi')).toBeInTheDocument();
    await advance(2_000);
    await advance(1_000);
    expect(screen.queryByText('Sezon kaydedildi')).not.toBeInTheDocument();
  });

  it('a toast with Geri al stays ten seconds', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<Buttons undo={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Sil' }));
    expect(await screen.findByText('Oturum silindi')).toBeInTheDocument();

    await advance(9_000);
    expect(screen.getByRole('button', { name: 'Geri al' })).toBeInTheDocument();
    await advance(2_000);
    await advance(1_000);
    expect(screen.queryByText('Oturum silindi')).not.toBeInTheDocument();
  });

  it('a failed Geri al stays until it is closed', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<Buttons undo={jest.fn().mockRejectedValue(new ProblemError(404, 'Not Found'))} />);
    await user.click(screen.getByRole('button', { name: 'Sil' }));
    await user.click(await screen.findByRole('button', { name: 'Geri al' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Geri alınamadı');

    await advance(120_000);
    expect(screen.getByRole('alert')).toHaveTextContent('Geri alınamadı');
  });
});
