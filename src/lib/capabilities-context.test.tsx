import { act, renderHook, waitFor } from '@testing-library/react';
import React, { type ReactNode } from 'react';
import { capabilitiesApi, type Capabilities } from '@/lib/api/capabilities';
import { SESSION_RENEWED_EVENT } from '@/lib/auth/session-renewal';
import { CapabilitiesProvider, useCapabilities } from '@/lib/capabilities-context';

jest.mock('@/lib/api/capabilities', () => ({
  capabilitiesApi: { get: jest.fn() },
}));

const get = capabilitiesApi.get as jest.Mock;

const MEMBER: Capabilities = { can: { 'event.create': false }, editableSites: [] };
const LEADER: Capabilities = {
  can: { 'event.create': false },
  teams: [{ team: 'WEBLAB', can: { 'event.create': true } }],
  editableSites: [],
};

function wrapper({ children }: { children: ReactNode }) {
  return <CapabilitiesProvider userId="user-1">{children}</CapabilitiesProvider>;
}

function renewToken() {
  act(() => {
    window.dispatchEvent(new Event(SESSION_RENEWED_EVENT));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CapabilitiesProvider', () => {
  it('reads again when the token is renewed and shows a team joined meanwhile', async () => {
    get.mockResolvedValueOnce(MEMBER).mockResolvedValueOnce(LEADER);
    const { result } = renderHook(() => useCapabilities(), { wrapper });
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', data: MEMBER }));

    renewToken();

    // The old answer stays on screen while the new one comes.
    expect(result.current.status).toBe('ready');
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', data: LEADER }));
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('keeps the answer when the new read fails: a failed read would open every gate', async () => {
    get.mockResolvedValueOnce(MEMBER).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useCapabilities(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    renewToken();

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(result.current).toEqual({ status: 'ready', data: MEMBER });
  });

  it('keeps the same answer object when nothing changed', async () => {
    get.mockResolvedValue(MEMBER);
    const { result } = renderHook(() => useCapabilities(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const before = result.current;

    renewToken();

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(result.current).toBe(before);
  });
});
