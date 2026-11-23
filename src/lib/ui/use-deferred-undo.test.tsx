import { act, render, screen } from '@testing-library/react';
import { ProblemError } from '@/lib/api/core';
import { UNDO_GRACE_MS, useDeferredUndo } from '@/lib/ui/use-deferred-undo';

function Desk({ run }: { run: () => Promise<unknown> }) {
  const deferred = useDeferredUndo();
  return (
    <>
      <button
        type="button"
        onClick={() => deferred.schedule('ci1', 'Ece: giriş geri alınıyor', run)}
      >
        Geri al
      </button>
      <p>{deferred.pending.size} bekliyor</p>
    </>
  );
}

function unloadAsked(): boolean {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('useDeferredUndo', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('asks before the tab closes only while an entry waits', async () => {
    const run = jest.fn().mockResolvedValue(undefined);
    render(<Desk run={run} />);
    expect(unloadAsked()).toBe(false);

    act(() => screen.getByRole('button', { name: 'Geri al' }).click());
    expect(screen.getByText('1 bekliyor')).toBeInTheDocument();
    expect(unloadAsked()).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(UNDO_GRACE_MS);
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.getByText('0 bekliyor')).toBeInTheDocument();
    expect(unloadAsked()).toBe(false);
  });

  it('stops asking once Vazgeç keeps the entry', () => {
    const run = jest.fn().mockResolvedValue(undefined);
    render(<Desk run={run} />);
    act(() => screen.getByRole('button', { name: 'Geri al' }).click());
    act(() => screen.getAllByRole('button', { name: 'Vazgeç' })[0].click());
    expect(unloadAsked()).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('sends what waits when the page goes, and says on a toast when that failed', async () => {
    const run = jest.fn().mockRejectedValue(new ProblemError(409, 'Conflict'));
    const { rerender } = render(<Desk run={run} />);
    act(() => screen.getByRole('button', { name: 'Geri al' }).click());

    await act(async () => {
      rerender(<p>başka sayfa</p>);
    });

    expect(run).toHaveBeenCalledTimes(1);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Geri alınamadı');
    expect(alert).toHaveTextContent('Bu kayıt artık geri alınamıyor');
    expect(unloadAsked()).toBe(false);
  });

  it('leaves a failure to the page while the page is up', async () => {
    const run = jest.fn().mockRejectedValue(new ProblemError(409, 'Conflict'));
    render(<Desk run={run} />);
    act(() => screen.getByRole('button', { name: 'Geri al' }).click());
    await act(async () => {
      jest.advanceTimersByTime(UNDO_GRACE_MS);
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sends nothing on leaving when nothing waits', async () => {
    const run = jest.fn().mockResolvedValue(undefined);
    const { rerender } = render(<Desk run={run} />);
    await act(async () => {
      rerender(<p>başka sayfa</p>);
    });
    expect(run).not.toHaveBeenCalled();
  });
});
