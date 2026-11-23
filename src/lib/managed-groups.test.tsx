import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { identityApi } from '@/lib/api/identity';
import { useManagedGroups } from '@/lib/managed-groups';

jest.mock('@/lib/api/capabilities', () => ({
  capabilitiesApi: { get: jest.fn() },
}));
jest.mock('@/lib/api/identity', () => ({
  identityApi: { managedGroups: jest.fn() },
}));

const WEBLAB = { id: 'g-web', code: 'WEBLAB', path: '/UYELER/ARGE/WEBLAB', children: [] };

let reload: () => void = () => undefined;

function Probe({ privileged }: { privileged?: boolean }) {
  const managed = useManagedGroups({ privileged });
  reload = managed.reload;
  return (
    <p>
      {managed.status === 'ready'
        ? `ready:${managed.groups.map((group) => group.code).join(',')}`
        : managed.status}
    </p>
  );
}

describe('useManagedGroups', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads no tree for someone core names no managed Team (team delegation off)', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: {}, managedTeams: [] });
    render(<Probe />);
    expect(await screen.findByText('ready:')).toBeInTheDocument();
    expect(identityApi.managedGroups).not.toHaveBeenCalled();
  });

  it('reads it for a Privileged reader, whom core answers every Team', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: {}, managedTeams: [] });
    (identityApi.managedGroups as jest.Mock).mockResolvedValue([WEBLAB]);
    render(<Probe privileged />);
    expect(await screen.findByText('ready:WEBLAB')).toBeInTheDocument();
  });

  it('reads it again on reload, keeping the tree shown meanwhile', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      managedTeams: [{ id: 'g-web', path: '/UYELER/ARGE/WEBLAB', code: 'WEBLAB' }],
    });
    (identityApi.managedGroups as jest.Mock).mockResolvedValueOnce([WEBLAB]);
    render(<Probe />);
    expect(await screen.findByText('ready:WEBLAB')).toBeInTheDocument();

    let answer: (value: unknown) => void = () => undefined;
    (identityApi.managedGroups as jest.Mock).mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    act(() => reload());
    await waitFor(() => expect(identityApi.managedGroups).toHaveBeenCalledTimes(2));
    expect(screen.getByText('ready:WEBLAB')).toBeInTheDocument();
    await act(async () => answer([{ ...WEBLAB, code: 'WEB' }]));
    expect(await screen.findByText('ready:WEB')).toBeInTheDocument();
  });
});
