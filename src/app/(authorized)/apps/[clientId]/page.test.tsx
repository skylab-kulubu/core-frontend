import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import AppAssignmentsPage from '@/app/(authorized)/apps/[clientId]/page';
import { appsApi, type AppAssignment, type AppAssignments } from '@/lib/api/apps';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { ProblemError } from '@/lib/api/core';

// The address is the page's state (?bolum=, ?view=): the hooks write history, this reads it back
const mockListeners = new Set<() => void>();
function mockSubscribe(listener: () => void) {
  mockListeners.add(listener);
  return () => mockListeners.delete(listener);
}
for (const method of ['pushState', 'replaceState'] as const) {
  const original = window.history[method].bind(window.history);
  window.history[method] = (...args: Parameters<History['pushState']>) => {
    original(...args);
    mockListeners.forEach((listener) => listener());
  };
}
jest.mock('next/navigation', () => ({
  useParams: () => ({ clientId: 'skynotify' }),
  useRouter: () => ({
    push: (href: string) => window.history.pushState(null, '', href),
    replace: jest.fn(),
  }),
  usePathname: () => '/apps/skynotify',
  useSearchParams: () => {
    const { useSyncExternalStore } = jest.requireActual('react') as typeof import('react');
    const text = useSyncExternalStore(
      mockSubscribe,
      () => window.location.search,
      () => '',
    );
    return new URLSearchParams(text);
  },
}));

function at(search = '') {
  window.history.replaceState(null, '', `/apps/skynotify${search ? `?${search}` : ''}`);
}
jest.mock('@/lib/api/capabilities', () => ({ capabilitiesApi: { get: jest.fn() } }));
jest.mock('@/lib/api/apps', () => ({
  appsApi: {
    assignments: jest.fn(),
    assign: jest.fn(),
    unassign: jest.fn(),
    audit: jest.fn(),
    targets: jest.fn(),
  },
}));

const team: AppAssignment = {
  type: 'group',
  id: 'g-web',
  role: 'skynotify:access',
  area: 'panel',
  path: '/UYELER/ARGE/WEBLAB',
  name: 'Web Lab',
  inheritsTo: 4,
  members: 23,
  assignedBy: { id: 'u-yk', name: 'Yusuf A' },
  assignedAt: '2026-10-23T09:30:00Z',
};
const board: AppAssignment = {
  type: 'group',
  id: 'g-yk',
  role: 'skynotify:access',
  area: 'code',
  reason: 'code_area',
  path: '/UYELER/YK',
  name: 'YK',
  inheritsTo: 7,
  members: 8,
  assignedBy: null,
  assignedAt: null,
};
const person: AppAssignment = {
  type: 'user',
  id: 'u-ada',
  role: 'skynotify:templates:read',
  area: 'panel',
  name: 'Ada L',
  email: 'ada@example.com',
  inheritsTo: 0,
  members: 1,
  assignedBy: null,
  assignedAt: null,
};

function answer(rows: AppAssignment[]): AppAssignments {
  return {
    app: {
      clientId: 'skynotify',
      name: 'SkyNotify',
      assignmentRequired: true,
      roles: ['skynotify:access', 'skynotify:templates:read'],
      suggestedRoles: ['skynotify:access', 'skynotify:templates:read'],
      groups: 2,
      users: 1,
    },
    auditVisible: true,
    assignments: rows,
  };
}

function writer() {
  (capabilitiesApi.get as jest.Mock).mockResolvedValue({
    can: { 'apps.read': true, 'apps.assign': true, 'audit.read': true },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  at('bolum=atamalar');
  (appsApi.assignments as jest.Mock).mockResolvedValue(answer([team, board, person]));
  (appsApi.audit as jest.Mock).mockResolvedValue([]);
  (appsApi.assign as jest.Mock).mockResolvedValue(team);
  (appsApi.unassign as jest.Mock).mockResolvedValue(undefined);
});

describe('SkyNotify · Kullanıcılar ve gruplar', () => {
  it('lists Groups and people, the code’s rows locked with the reason written, and filters to people', async () => {
    writer();
    const user = userEvent.setup();
    render(<AppAssignmentsPage />);
    expect(await screen.findByText('Web Lab')).toBeInTheDocument();
    expect(screen.getAllByText('Yalnız atananlar').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/\/UYELER\/ARGE\/WEBLAB · Alt ekipleri de kapsar \(4 grup\)/),
    ).toBeInTheDocument();
    expect(screen.getByText('Yusuf A')).toBeInTheDocument();
    expect(screen.getAllByText('Kayıt yok')).toHaveLength(2);
    expect(screen.getByText('Kodda tanımlı')).toBeInTheDocument();
    // Kaldır on the panel's two rows, not on YK's
    expect(screen.getAllByRole('button', { name: 'Kaldır' })).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: /^Yalnız kişiler/ }));
    await waitFor(() => expect(screen.queryByText('Web Lab')).not.toBeInTheDocument());
    expect(screen.getByText('Ada L')).toBeInTheDocument();
    expect(window.location.search).toContain('view=user');
  });

  it('opens on the overview: the id to copy, who may open it, the counts and the latest changes', async () => {
    writer();
    at();
    (appsApi.audit as jest.Mock).mockResolvedValue([
      {
        id: 'r1',
        occurredAt: '2026-10-23T09:30:00Z',
        action: 'app.assign',
        outcome: 'ok',
        actor: { id: 'u-yk', name: 'Yusuf A' },
        type: 'group',
        targetId: 'g-web',
        path: '/UYELER/ARGE/WEBLAB',
        name: 'Web Lab',
        role: 'skynotify:access',
      },
    ]);
    const user = userEvent.setup();
    render(<AppAssignmentsPage />);
    expect(await screen.findByText('skynotify')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kimliği kopyala' })).toBeInTheDocument();
    const figures = screen.getByRole('group', { name: 'Atama sayıları' });
    expect(within(figures).getByRole('button', { name: /Grup ataması\s*2/ })).toBeInTheDocument();
    expect(within(figures).getByRole('button', { name: /Kodda tanımlı\s*1/ })).toBeInTheDocument();
    expect(await screen.findByText('Yusuf A · Atama')).toBeInTheDocument();
    await user.click(within(figures).getByRole('button', { name: /Kişi ataması/ }));
    expect(window.location.search).toBe('?bolum=atamalar&view=user');
  });

  it('opens Ekle on the Grup tab, suggests SkyNotify’s pair and assigns each role, no note', async () => {
    writer();
    (appsApi.targets as jest.Mock).mockResolvedValue([
      {
        type: 'group',
        id: 'g-algo',
        path: '/UYELER/ARGE/ALGOLAB',
        name: 'ALGOLAB',
        inheritsTo: 2,
        members: 9,
        assignedRoles: [],
      },
    ]);
    const user = userEvent.setup();
    render(<AppAssignmentsPage />);
    await user.click(await screen.findByRole('button', { name: 'Ekle' }));
    const drawer = await screen.findByRole('dialog', { name: 'Ekle' });
    expect(within(drawer).getByRole('tab', { name: 'Grup' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await waitFor(() => expect(appsApi.targets).toHaveBeenCalledWith('skynotify', 'group', ''));
    await user.click(await within(drawer).findByRole('button', { name: /ALGOLAB/ }));
    expect(within(drawer).getByRole('checkbox', { name: 'skynotify:access' })).toBeChecked();
    expect(
      within(drawer).getByRole('checkbox', { name: 'skynotify:templates:read' }),
    ).toBeChecked();
    // No free-text note: Entra's assignment has none, core keeps none.
    expect(within(drawer).queryByRole('textbox')).not.toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Ata' }));
    await waitFor(() => expect(appsApi.assign).toHaveBeenCalledTimes(2));
    expect(appsApi.assign).toHaveBeenNthCalledWith(1, 'skynotify', {
      type: 'group',
      id: 'g-algo',
      role: 'skynotify:access',
    });
    expect(appsApi.assign).toHaveBeenNthCalledWith(2, 'skynotify', {
      type: 'group',
      id: 'g-algo',
      role: 'skynotify:templates:read',
    });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Ekle' })).not.toBeInTheDocument(),
    );
  });

  it('says the Kişi tab’s rule and a refusal in Turkish', async () => {
    writer();
    (appsApi.targets as jest.Mock).mockResolvedValue([
      {
        type: 'user',
        id: 'u-cem',
        name: 'Cem D',
        email: 'c***@example.com',
        inheritsTo: 0,
        members: 1,
        assignedRoles: [],
      },
    ]);
    (appsApi.assign as jest.Mock).mockRejectedValue(
      new ProblemError(409, 'Conflict', {
        code: 'role_placement',
        detail: 'A service account',
        fields: { reason: 'service_account' },
      }),
    );
    const user = userEvent.setup();
    render(<AppAssignmentsPage />);
    await user.click(await screen.findByRole('button', { name: 'Ekle' }));
    const drawer = await screen.findByRole('dialog', { name: 'Ekle' });
    await user.click(within(drawer).getByRole('tab', { name: 'Kişi' }));
    expect(
      within(drawer).getByText('Önerilen yol grup; kişiye atama istisnadır.'),
    ).toBeInTheDocument();
    expect(within(drawer).getByText('En az 3 karakter yaz')).toBeInTheDocument();
    await user.type(within(drawer).getByRole('searchbox', { name: 'Kişi ara' }), 'ce');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(appsApi.targets).not.toHaveBeenCalledWith('skynotify', 'user', 'ce');
    await user.type(within(drawer).getByRole('searchbox', { name: 'Kişi ara' }), 'm');
    await user.click(await within(drawer).findByRole('button', { name: /Cem D/ }));
    await user.click(within(drawer).getByRole('checkbox', { name: 'skynotify:templates:read' }));
    await user.click(within(drawer).getByRole('button', { name: 'Ata' }));
    expect(await within(drawer).findByRole('alert')).toHaveTextContent(
      'skynotify:access: Servis hesaplarının rolleri kodda tanımlıdır.',
    );
    expect(drawer).not.toHaveTextContent('A service account');
  });

  it('asks before a removal, naming how many people lose it', async () => {
    writer();
    const user = userEvent.setup();
    render(<AppAssignmentsPage />);
    const row = (await screen.findByText('Web Lab')).closest('li, a, div') as HTMLElement;
    expect(row).toBeTruthy();
    await user.click(screen.getAllByRole('button', { name: 'Kaldır' })[0]!);
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Bu atama 23 kişinin erişimini kaldırır.');
    await user.click(within(dialog).getByRole('button', { name: 'Atamayı kaldır' }));
    await waitFor(() =>
      expect(appsApi.unassign).toHaveBeenCalledWith('skynotify', {
        type: 'group',
        id: 'g-web',
        role: 'skynotify:access',
      }),
    );
  });

  it('shows DK the list and the audit, and nothing to change', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      can: { 'apps.read': true, 'apps.assign': false, 'audit.read': true },
    });
    (appsApi.audit as jest.Mock).mockResolvedValue([
      {
        id: 'r1',
        occurredAt: '2026-10-23T09:30:00Z',
        action: 'app.assign',
        outcome: 'ok',
        actor: { id: 'u-yk', name: 'Yusuf A' },
        type: 'group',
        targetId: 'g-web',
        path: '/UYELER/ARGE/WEBLAB',
        role: 'skynotify:access',
      },
    ]);
    const user = userEvent.setup();
    render(<AppAssignmentsPage />);
    expect(await screen.findByText('Web Lab')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ekle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kaldır' })).not.toBeInTheDocument();
    act(() => at('bolum=denetim'));
    expect(await screen.findByText('Yusuf A · Atama')).toBeInTheDocument();
    expect(
      screen.getByText(/^\/UYELER\/ARGE\/WEBLAB · skynotify:access · [^·]+$/),
    ).toBeInTheDocument();
  });

  it('reads nothing while core’s app assignments are off', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: {} });
    render(<AppAssignmentsPage />);
    expect(await screen.findByText('Bu sayfaya erişimin yok')).toBeInTheDocument();
    expect(appsApi.assignments).not.toHaveBeenCalled();
  });
});
