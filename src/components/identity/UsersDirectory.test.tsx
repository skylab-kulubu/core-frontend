import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { dashboardApi } from '@/lib/api/dashboard';
import { identityApi } from '@/lib/api/identity';
import { UsersDirectory } from './UsersDirectory';

jest.mock('@skylab-kulubu/skylcn-ui/charts', () => ({
  BarChart: ({ title }: { title: React.ReactNode }) => <div>{title}</div>,
}));
jest.mock('@/lib/api/dashboard', () => ({ dashboardApi: { summary: jest.fn() } }));
jest.mock('@/lib/api/identity', () => ({
  identityApi: { listGroups: jest.fn(), members: jest.fn(), getUser: jest.fn() },
}));

const members = {
  active: 187,
  newByMonth: [
    { month: '2026-10', count: 20 },
    { month: '2026-11', count: 25 },
  ],
  recentJoiners: [
    {
      id: 'u1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      teams: ['WEBLAB'],
      registeredAt: '2026-11-20T10:00:00Z',
    },
  ],
  asOf: '2026-11-22T10:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  (dashboardApi.summary as jest.Mock).mockResolvedValue({ members });
  (identityApi.listGroups as jest.Mock).mockResolvedValue([
    { id: 'g-web', name: 'WEBLAB', path: '/UYELER/ARGE/WEBLAB' },
    { id: 'g-yk', name: 'YK', path: '/YK' },
  ]);
  (identityApi.members as jest.Mock).mockResolvedValue([
    { id: 'u2', firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com' },
  ]);
});

const base = {
  query: '',
  onQuery: jest.fn(),
  results: [],
  searching: false,
  searchFailed: false,
  ready: false,
};

describe.each(['a', 'b'] as const)('UsersDirectory %s', (variant) => {
  it('opens on the member figures and the latest joiners', async () => {
    render(<UsersDirectory variant={variant} {...base} />);
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('187')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace').closest('a')).toHaveAttribute('href', '/users/u1');
  });

  it("lists a team's members", async () => {
    render(<UsersDirectory variant={variant} {...base} />);
    await screen.findByText('Ada Lovelace');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Ekip' }), 'g-web');
    expect(await screen.findByText('Grace Hopper')).toBeInTheDocument();
    expect(identityApi.members).toHaveBeenCalledWith('g-web');
    expect(screen.queryByRole('option', { name: 'YK' })).not.toBeInTheDocument();
  });

  it('shows the search when it runs', async () => {
    render(
      <UsersDirectory
        variant={variant}
        {...base}
        query="gra"
        ready
        results={[{ id: 'u2', firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com' }]}
      />,
    );
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeInTheDocument());
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
  });
});
