import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ProblemError } from '@/lib/api/core';
import { dashboardApi } from '@/lib/api/dashboard';
import { identityApi } from '@/lib/api/identity';
import { UsersDirectory } from './UsersDirectory';

jest.mock('@skylab-kulubu/skylcn-ui/charts', () => ({
  BarChart: ({ title }: { title: React.ReactNode }) => <div>{title}</div>,
}));
jest.mock('@/lib/api/dashboard', () => ({ dashboardApi: { summary: jest.fn() } }));
jest.mock('@/lib/api/identity', () => ({
  identityApi: {
    listGroups: jest.fn(),
    members: jest.fn(),
    getUser: jest.fn(),
    listUsers: jest.fn(),
    userDirectory: jest.fn(),
    memberCheck: jest.fn(),
    addMember: jest.fn(),
  },
}));
// The list's place, kept in state here as the address keeps it in the app
jest.mock('@/lib/ui/use-list-params', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    useListParams: ({ view = 'all' }: { view?: string } = {}) => {
      const [state, setState] = ReactActual.useState({
        q: '',
        view,
        sort: '',
        page: 1,
        panel: null as string | null,
      });
      return [
        state,
        (change: Record<string, unknown>) =>
          setState((now) => ({
            ...now,
            ...('q' in change || 'view' in change ? { page: 1 } : {}),
            ...change,
          })),
      ];
    },
  };
});

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

const GRACE = {
  id: 'u2',
  firstName: 'Grace',
  lastName: 'Hopper',
  email: 'grace@example.com',
  schoolEmail: '',
  createdAt: '2026-11-21T10:00:00Z',
};
const ALAN = {
  id: 'u3',
  firstName: 'Alan',
  lastName: 'Turing',
  email: 'alan@example.com',
  schoolEmail: 'alan@std.yildiz.edu.tr',
  createdAt: '2026-10-02T10:00:00Z',
};

const props = { canCreate: true, onCreate: jest.fn(), canAddToGroup: true };

beforeEach(() => {
  jest.clearAllMocks();
  (dashboardApi.summary as jest.Mock).mockResolvedValue({ members });
  (identityApi.listGroups as jest.Mock).mockResolvedValue([
    { id: 'g-web', name: 'WEBLAB', path: '/UYELER/ARGE/WEBLAB' },
    { id: 'g-yk', name: 'YK', path: '/YK' },
  ]);
  (identityApi.members as jest.Mock).mockResolvedValue([GRACE]);
  (identityApi.userDirectory as jest.Mock).mockResolvedValue({
    items: [GRACE, ALAN],
    total: 2,
    page: 1,
    size: 50,
  });
  (identityApi.getUser as jest.Mock).mockResolvedValue({ ...GRACE, groups: [] });
});

describe('UsersDirectory with core’s directory', () => {
  it('lists everyone a page at a time with the member figures over them', async () => {
    render(<UsersDirectory {...props} />);
    expect(await screen.findByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.getByText('Alan Turing')).toBeInTheDocument();
    expect(identityApi.userDirectory).toHaveBeenCalledWith({
      page: 1,
      size: 50,
      q: '',
      filter: '',
    });
    expect(await screen.findByText('187')).toBeInTheDocument();
    expect(screen.getByText('Aylık yeni üye')).toBeInTheDocument();
    // No school address yet: said in the row
    expect(screen.getByText('Yok')).toBeInTheDocument();
  });

  it('asks core for a view’s people', async () => {
    const user = userEvent.setup();
    render(<UsersDirectory {...props} />);
    await screen.findByText('Grace Hopper');
    await user.click(screen.getByRole('button', { name: /Okul e-postası yok/ }));
    await waitFor(() =>
      expect(identityApi.userDirectory).toHaveBeenLastCalledWith({
        page: 1,
        size: 50,
        q: '',
        filter: 'no_school_email',
      }),
    );
  });

  it('lists a team’s members', async () => {
    const user = userEvent.setup();
    render(<UsersDirectory {...props} />);
    await screen.findByText('Alan Turing');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Ekip' }), 'g-web');
    expect(await screen.findByText('WEBLAB üyeleri')).toBeInTheDocument();
    expect(identityApi.members).toHaveBeenCalledWith('g-web');
    await waitFor(() => expect(screen.queryByText('Alan Turing')).toBeNull());
  });

  it('opens a person beside the list with their Groups', async () => {
    (identityApi.getUser as jest.Mock).mockResolvedValue({
      ...GRACE,
      groups: [{ id: 'g-web', name: 'WEBLAB', path: '/UYELER/ARGE/WEBLAB' }],
    });
    const user = userEvent.setup();
    render(<UsersDirectory {...props} />);
    await user.click(await screen.findByRole('button', { name: 'Grace Hopper' }));
    const panel = await screen.findByRole('dialog', { name: 'Grace Hopper' });
    expect(await within(panel).findByText('/UYELER/ARGE/WEBLAB')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: /Tam sayfa/ })).toHaveAttribute(
      'href',
      '/users/u2',
    );
  });

  it('puts the chosen people in a Group, asking first and naming the unverified', async () => {
    (identityApi.memberCheck as jest.Mock).mockImplementation((_group: string, userId: string) =>
      Promise.resolve({
        privileged: true,
        ytuLinked: userId !== 'u2',
        warnings: userId === 'u2' ? ['not_ytu_verified'] : [],
      }),
    );
    (identityApi.addMember as jest.Mock).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<UsersDirectory {...props} />);
    await user.click(await screen.findByRole('checkbox', { name: 'Grace Hopper seç' }));
    await user.click(screen.getByRole('checkbox', { name: 'Alan Turing seç' }));
    await user.click(screen.getByRole('button', { name: 'Gruba ekle' }));
    const picker = await screen.findByRole('dialog', { name: 'Gruba ekle' });
    await user.click(await within(picker).findByRole('button', { name: /YK/ }));
    const ask = await screen.findByRole('alertdialog', { name: '2 kişi YK grubuna eklensin mi?' });
    expect(ask).toHaveTextContent('Grace Hopper (grace@example.com)');
    expect(identityApi.addMember).not.toHaveBeenCalled();
    await user.click(within(ask).getByRole('button', { name: 'Gruba ekle' }));
    await waitFor(() =>
      expect((identityApi.addMember as jest.Mock).mock.calls).toEqual([
        ['g-yk', 'u2', { unverifiedAck: true }],
        ['g-yk', 'u3'],
      ]),
    );
    expect(await screen.findByText('2 kişi eklendi')).toBeInTheDocument();
  });

  it('offers no choosing to someone who cannot change Groups', async () => {
    render(<UsersDirectory {...props} canAddToGroup={false} />);
    await screen.findByText('Grace Hopper');
    expect(screen.queryByRole('checkbox', { name: 'Grace Hopper seç' })).toBeNull();
  });
});

describe('UsersDirectory with an older core (no directory)', () => {
  beforeEach(() => {
    (identityApi.userDirectory as jest.Mock).mockRejectedValue(new ProblemError(404, 'Not Found'));
  });

  it('opens on the latest joiners', async () => {
    render(<UsersDirectory {...props} />);
    expect(await screen.findByText('Son katılanlar')).toBeInTheDocument();
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('searches the people as before', async () => {
    (identityApi.listUsers as jest.Mock).mockResolvedValue([ALAN]);
    const user = userEvent.setup();
    render(<UsersDirectory {...props} />);
    await screen.findByText('Ada Lovelace');
    await user.type(screen.getByRole('searchbox', { name: 'Kullanıcı ara' }), 'alan');
    expect(await screen.findByText('Alan Turing')).toBeInTheDocument();
    expect(identityApi.listUsers).toHaveBeenLastCalledWith('alan');
  });
});

it('says the list could not be read, and reads it again', async () => {
  (identityApi.userDirectory as jest.Mock)
    .mockRejectedValueOnce(new ProblemError(503, 'Unavailable'))
    .mockResolvedValue({ items: [GRACE], total: 1, page: 1, size: 50 });
  const user = userEvent.setup();
  render(<UsersDirectory {...props} />);
  await user.click(await screen.findByRole('button', { name: 'Tekrar dene' }));
  expect(await screen.findByText('Grace Hopper')).toBeInTheDocument();
});
