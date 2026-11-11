import { act, renderHook } from '@testing-library/react';
import { SESSION_RENEWED_EVENT } from '@/lib/auth/session-renewal';
import {
  OPEN_REFRESH_INTERVAL_MS,
  RETURN_REFRESH_MIN_MS,
  useRefreshOnReturn,
} from '@/lib/use-refresh-on-return';

let visibility: DocumentVisibilityState = 'visible';

function come(kind: 'focus' | 'visibilitychange' | 'renewed') {
  act(() => {
    if (kind === 'focus') window.dispatchEvent(new Event('focus'));
    else if (kind === 'visibilitychange') document.dispatchEvent(new Event('visibilitychange'));
    else window.dispatchEvent(new Event(SESSION_RENEWED_EVENT));
  });
}

describe('useRefreshOnReturn', () => {
  beforeAll(() => {
    jest.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    visibility = 'visible';
    jest.useFakeTimers({ now: 1_800_000_000_000 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reads again when the person comes back, at most once per interval', () => {
    const refresh = jest.fn();
    renderHook(() => useRefreshOnReturn(refresh));

    // The page has just loaded and read.
    come('focus');
    expect(refresh).not.toHaveBeenCalled();

    jest.advanceTimersByTime(RETURN_REFRESH_MIN_MS);
    come('visibilitychange');
    come('focus');
    expect(refresh).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(RETURN_REFRESH_MIN_MS);
    come('focus');
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('does not read for a tab that was hidden', () => {
    const refresh = jest.fn();
    renderHook(() => useRefreshOnReturn(refresh));
    jest.advanceTimersByTime(RETURN_REFRESH_MIN_MS);

    visibility = 'hidden';
    come('visibilitychange');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('reads whenever the token was renewed', () => {
    const refresh = jest.fn();
    renderHook(() => useRefreshOnReturn(refresh));
    come('renewed');
    come('renewed');
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('does nothing while disabled', () => {
    const refresh = jest.fn();
    renderHook(() => useRefreshOnReturn(refresh, false));
    jest.advanceTimersByTime(RETURN_REFRESH_MIN_MS);
    come('focus');
    come('renewed');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('reads an open, shown tab again once the interval has passed', () => {
    const refresh = jest.fn();
    renderHook(() => useRefreshOnReturn(refresh));

    act(() => {
      jest.advanceTimersByTime(OPEN_REFRESH_INTERVAL_MS - 60_000);
    });
    expect(refresh).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(OPEN_REFRESH_INTERVAL_MS);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('counts the interval from the last read, so a return read postpones it', () => {
    const refresh = jest.fn();
    renderHook(() => useRefreshOnReturn(refresh));

    act(() => {
      jest.advanceTimersByTime(OPEN_REFRESH_INTERVAL_MS - 60_000);
    });
    come('focus');
    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(OPEN_REFRESH_INTERVAL_MS - 60_000);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not read a hidden tab on the interval', () => {
    const refresh = jest.fn();
    renderHook(() => useRefreshOnReturn(refresh));
    visibility = 'hidden';
    act(() => {
      jest.advanceTimersByTime(3 * OPEN_REFRESH_INTERVAL_MS);
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('stops the interval when unmounted or disabled', () => {
    const refresh = jest.fn();
    const { unmount } = renderHook(() => useRefreshOnReturn(refresh));
    unmount();
    renderHook(() => useRefreshOnReturn(refresh, false));
    act(() => {
      jest.advanceTimersByTime(3 * OPEN_REFRESH_INTERVAL_MS);
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});
