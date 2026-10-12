import { renderHook } from '@testing-library/react';
import { SESSION_DEADLINE_CHECK_MS, useSessionDeadline } from '@/lib/auth/use-session-deadline';

describe('useSessionDeadline', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: 1_800_000_000_000 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sends the admin to sign in again once the session has run out, and only once', () => {
    const expire = jest.fn();
    renderHook(() => useSessionDeadline(120, expire));

    jest.advanceTimersByTime(119_000);
    expect(expire).not.toHaveBeenCalled();

    jest.advanceTimersByTime(SESSION_DEADLINE_CHECK_MS + 1_000);
    expect(expire).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(10 * SESSION_DEADLINE_CHECK_MS);
    expect(expire).toHaveBeenCalledTimes(1);
  });

  it('catches up as soon as the tab is shown again after the computer slept past the deadline', () => {
    const expire = jest.fn();
    renderHook(() => useSessionDeadline(3600, expire));

    // Asleep: the wall clock moves on while no timer runs.
    jest.setSystemTime(Date.now() + 9 * 3600 * 1000);
    expect(expire).not.toHaveBeenCalled();
    document.dispatchEvent(new Event('visibilitychange'));

    expect(expire).toHaveBeenCalledTimes(1);
  });

  it('acts at once on a session that is already over', () => {
    const expire = jest.fn();
    renderHook(() => useSessionDeadline(0, expire));

    expect(expire).toHaveBeenCalledTimes(1);
  });

  it('does nothing without a deadline, or after the page has gone', () => {
    const expire = jest.fn();
    renderHook(() => useSessionDeadline(undefined, expire));
    const { unmount } = renderHook(() => useSessionDeadline(60, expire));
    unmount();

    jest.advanceTimersByTime(3600 * 1000);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(expire).not.toHaveBeenCalled();
  });
});
