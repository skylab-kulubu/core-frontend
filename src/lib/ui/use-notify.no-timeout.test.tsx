import { renderHook } from '@testing-library/react';
import { useNotify } from '@/lib/ui/use-notify';

const add = jest.fn((_options: Record<string, unknown>) => 'toast-1');
const close = jest.fn();

jest.mock('@skylab-kulubu/skylcn-ui', () => ({
  ...jest.requireActual('@skylab-kulubu/skylcn-ui'),
  useToast: () => ({ add, close }),
}));

describe('useNotify leaves toast durations to skylcn-ui', () => {
  it('passes no timeout for a success, an undo or a failed undo', async () => {
    const { result } = renderHook(() => useNotify());
    result.current.success('Sezon kaydedildi');
    result.current.undoable('Oturum silindi', () => Promise.reject(new Error('x')), 'geri');
    const action = add.mock.calls[1]?.[0].actionProps as { onClick: () => void };
    action.onClick();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(add).toHaveBeenCalledTimes(3);
    expect(add.mock.calls[2]?.[0]).toMatchObject({ type: 'error' });
    for (const [options] of add.mock.calls) expect(options).not.toHaveProperty('timeout');
  });
});
