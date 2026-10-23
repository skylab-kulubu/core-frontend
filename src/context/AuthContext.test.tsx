import { act, renderHook, waitFor } from '@testing-library/react';
import React, { type ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SESSION_RENEWED_EVENT } from '@/lib/auth/session-renewal';
import type { UserDto } from '@/types/api';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn() }),
  usePathname: () => '/dashboard',
}));

const MEMBER: UserDto = {
  id: 'user-1',
  username: 'ayse',
  email: 'ayse@example.test',
  firstName: 'Ayşe',
  lastName: 'Yılmaz',
  roles: [],
  groups: ['/UYELER'],
};
const LEADER: UserDto = { ...MEMBER, groups: ['/UYELER', '/UYELER/WEBLAB/LIDERLER'] };

/** What fetch resolves to, as far as AuthProvider reads it (jsdom has no Response). */
function answer(body: unknown, status = 200) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });
}

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider initialUser={MEMBER}>{children}</AuthProvider>;
}

function renewToken() {
  act(() => {
    window.dispatchEvent(new Event(SESSION_RENEWED_EVENT));
  });
}

const fetchMock = jest.fn();

beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});

beforeEach(() => {
  fetchMock.mockReset();
  window.sessionStorage.clear();
});

describe('AuthProvider', () => {
  it('reads the person again when the token is renewed, so the sidebar shows a group joined meanwhile', async () => {
    fetchMock
      .mockReturnValueOnce(answer({ authenticated: true, user: MEMBER }))
      .mockReturnValueOnce(answer({ authenticated: true, user: LEADER }));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    renewToken();

    await waitFor(() => expect(result.current.user?.groups).toEqual(LEADER.groups));
    expect(fetchMock).toHaveBeenLastCalledWith('/api/auth/me', { credentials: 'include' });
  });

  it('keeps the person shown when that read fails', async () => {
    fetchMock
      .mockReturnValueOnce(answer({ authenticated: true, user: MEMBER }))
      .mockReturnValueOnce(answer({ authenticated: false }, 401))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    renewToken();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    renewToken();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    expect(result.current.user).toEqual(MEMBER);
  });
});
