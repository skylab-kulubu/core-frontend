import { renderHook, waitFor } from '@testing-library/react';
import React, { type ReactNode } from 'react';
import { capabilitiesApi, type Capabilities } from '@/lib/api/capabilities';
import { CapabilitiesProvider } from '@/lib/capabilities-context';
import { useAnyTeamCan, useAppCan, useAppCanSince, useTeamCan } from '@/lib/use-app-can';
import { useEventCreate } from '@/lib/use-event-create';

jest.mock('@/lib/api/capabilities', () => ({
  capabilitiesApi: { get: jest.fn() },
}));

const get = capabilitiesApi.get as jest.Mock;

/** A DK member who leads WEBLAB: reads everything, writes only in WEBLAB. */
const DK_LEADER: Capabilities = {
  can: { 'group.write': false, 'user.readFull': true },
  teams: [{ team: 'WEBLAB', can: { 'event.create': true, 'event.update': true } }],
  otherTeams: { can: { 'event.create': false, 'event.update': false } },
  noOwnerTeam: { can: { 'event.create': false, 'certificateTemplate.create': false } },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useTeamCan', () => {
  it('reads the scope of the record: own team, another team, no Owner team', async () => {
    get.mockResolvedValue(DK_LEADER);
    const { result } = renderHook(() => useTeamCan());
    await waitFor(() => expect(result.current('WEBLAB', 'event.update')).toBe(true));
    expect(result.current('GECEKODU', 'event.update')).toBe(false);
    expect(result.current('', 'event.create')).toBe(false);
  });

  it('is false while the answer is coming and true when it cannot be read', async () => {
    let fail: (error: Error) => void = () => undefined;
    get.mockReturnValue(
      new Promise((_, reject) => {
        fail = reject;
      }),
    );
    const { result } = renderHook(() => useTeamCan());
    expect(result.current('WEBLAB', 'event.update')).toBe(false);
    fail(new TypeError('Failed to fetch'));
    await waitFor(() => expect(result.current('WEBLAB', 'event.update')).toBe(true));
  });
});

describe('useAnyTeamCan and useAppCan', () => {
  it('answers from any team scope and from can', async () => {
    get.mockResolvedValue(DK_LEADER);
    const { result } = renderHook(() => ({ any: useAnyTeamCan(), app: useAppCan(true) }));
    await waitFor(() => expect(result.current.any('event.create')).toBe(true));
    expect(result.current.any('certificateTemplate.create')).toBe(false);
    expect(result.current.app('user.readFull')).toBe(true);
    expect(result.current.app('group.write')).toBe(false);
  });
});

describe('useAppCanSince', () => {
  it('reads the key, and the older key while core does not send it', async () => {
    get.mockResolvedValue({ can: { 'url.moderate': true, 'url.moderateWrite': false } });
    const { result } = renderHook(() => useAppCanSince(true));
    await waitFor(() => expect(result.current('url.moderate', 'url.moderate')).toBe(true));
    expect(result.current('url.moderateWrite', 'url.moderate')).toBe(false);

    get.mockResolvedValue({ can: { 'url.moderate': true } });
    const older = renderHook(() => useAppCanSince(false));
    await waitFor(() =>
      expect(older.result.current('url.moderateWrite', 'url.moderate')).toBe(true),
    );
  });

  it('is false while the answer is coming and the fallback when it cannot be read', async () => {
    let fail: (error: Error) => void = () => undefined;
    get.mockReturnValue(
      new Promise((_, reject) => {
        fail = reject;
      }),
    );
    const { result } = renderHook(() => useAppCanSince(true));
    expect(result.current('url.moderateWrite', 'url.moderate')).toBe(false);
    fail(new TypeError('Failed to fetch'));
    await waitFor(() => expect(result.current('url.moderateWrite', 'url.moderate')).toBe(true));
  });
});

describe('CapabilitiesProvider', () => {
  it('shares one request among every reader inside it', async () => {
    get.mockResolvedValue(DK_LEADER);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CapabilitiesProvider userId="u1">{children}</CapabilitiesProvider>
    );
    const { result } = renderHook(
      () => ({ app: useAppCan(false), team: useTeamCan(), any: useAnyTeamCan() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.app('user.readFull')).toBe(true));
    expect(get).toHaveBeenCalledTimes(1);
  });
});

describe('useEventCreate', () => {
  it('lets a DK member create only for the team they lead, as a Leader', async () => {
    get.mockResolvedValue(DK_LEADER);
    const { result } = renderHook(() =>
      useEventCreate(['/UYELER/DK', '/UYELER/ARGE/WEBLAB/LIDERLER']),
    );
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.canCreate).toBe(true);
    expect(result.current.privilegedWriter).toBe(false);
  });

  it('lets a DK member alone create nothing', async () => {
    get.mockResolvedValue({ ...DK_LEADER, teams: [] });
    const { result } = renderHook(() => useEventCreate(['/UYELER/DK']));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.canCreate).toBe(false);
  });

  it('keeps the group rule when the answer cannot be read', async () => {
    get.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useEventCreate(['/UYELER/YK']));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.canCreate).toBe(true);
    expect(result.current.privilegedWriter).toBe(true);
  });
});
