import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import AppAssignmentsPage from '@/app/(authorized)/apps/[clientId]/page';
import { appsApi, type AppAssignment, type AppAssignments } from '@/lib/api/apps';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { ProblemError } from '@/lib/api/core';

jest.mock('next/navigation', () => ({ useParams: () => ({ clientId: 'skymail' }) }));
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
  role: 'skymail:access',
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
  role: 'skymail:access',
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
  role: 'skymail:templates:read',
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
      clientId: 'skymail',
      name: 'SkyMail',
      assignmentRequired: true,
      roles: ['skymail:access', 'skymail:templates:read'],
      suggestedRoles: ['skymail:access', 'skymail:templates:read'],
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
  (appsApi.assignments as jest.Mock).mockResolvedValue(answer([team, board, person]));
  (appsApi.audit as jest.Mock).mockResolvedValue([]);
  (appsApi.assign as jest.Mock).mockResolvedValue(team);
  (appsApi.unassign as jest.Mock).mockResolvedValue(undefined);
});

describe('SkyMail · Kullanıcılar ve gruplar', () => {
  it('lists Groups and people, the code’s rows locked, and filters to people', async () => {
    writer();
    const user = userEvent.setup();
    render(<AppAssignmentsPage />);
    expect(await screen.findByText('Web Lab')).toBeInTheDocument();
    expect(screen.getByText('Atama gerekli: Evet')).toBeInTheDocument();
    expect(
      screen.getByText(/Alt ekipleri de kapsar \(4 grup\) · 23 kişi · Yusuf A/),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Kayıt yok \(panel öncesi ya da konsoldan\)/)).toHaveLength(2);
    expect(screen.getByText('Kodda tanımlı')).toBeInTheDocument();
    // Kaldır on the panel's two rows, not on YK's
    expect(screen.getAllByRole('button', { name: 'Kaldır' })).toHaveLength(2);

    await user.click(screen.getByText('Yalnız kişiler'));
    expect(screen.getByRole('switch', { name: /Yalnız kişiler/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.queryByText('Web Lab')).not.toBeInTheDocument();
    expect(screen.getByText('Ada L')).toBeInTheDocument();
  });

  it('opens Ekle on the Grup tab, suggests SkyMail’s pair and assigns each role with the note', async () => {
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
    await waitFor(() => expect(appsApi.targets).toHaveBeenCalledWith('skymail', 'group', ''));
    await user.click(await within(drawer).findByRole('button', { name: /ALGOLAB/ }));
    expect(within(drawer).getByRole('checkbox', { name: 'skymail:access' })).toBeChecked();
    expect(within(drawer).getByRole('checkbox', { name: 'skymail:templates:read' })).toBeChecked();
    await user.type(within(drawer).getByRole('textbox'), 'ekip talebi');
    await user.click(within(drawer).getByRole('button', { name: 'Ata' }));
    await waitFor(() => expect(appsApi.assign).toHaveBeenCalledTimes(2));
    expect(appsApi.assign).toHaveBeenNthCalledWith(1, 'skymail', {
      type: 'group',
      id: 'g-algo',
      role: 'skymail:access',
      note: 'ekip talebi',
    });
    expect(appsApi.assign).toHaveBeenNthCalledWith(2, 'skymail', {
      type: 'group',
      id: 'g-algo',
      role: 'skymail:templates:read',
      note: 'ekip talebi',
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
    expect(within(drawer).getByText('En az 3 karakter yazın')).toBeInTheDocument();
    await user.type(within(drawer).getByRole('searchbox', { name: 'Kişi ara' }), 'ce');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(appsApi.targets).not.toHaveBeenCalledWith('skymail', 'user', 'ce');
    await user.type(within(drawer).getByRole('searchbox', { name: 'Kişi ara' }), 'm');
    await user.click(await within(drawer).findByRole('button', { name: /Cem D/ }));
    await user.click(within(drawer).getByRole('checkbox', { name: 'skymail:templates:read' }));
    await user.click(within(drawer).getByRole('button', { name: 'Ata' }));
    expect(await within(drawer).findByRole('alert')).toHaveTextContent(
      'skymail:access: Servis hesaplarının rolleri kodda tanımlıdır.',
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
      expect(appsApi.unassign).toHaveBeenCalledWith('skymail', {
        type: 'group',
        id: 'g-web',
        role: 'skymail:access',
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
        role: 'skymail:access',
        note: 'ekip talebi',
      },
    ]);
    const user = userEvent.setup();
    render(<AppAssignmentsPage />);
    expect(await screen.findByText('Web Lab')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ekle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kaldır' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Denetim' }));
    expect(await screen.findByText('Yusuf A · Atama')).toBeInTheDocument();
    expect(
      screen.getByText(/\/UYELER\/ARGE\/WEBLAB · skymail:access · .* · ekip talebi/),
    ).toBeInTheDocument();
  });

  it('reads nothing while core’s app assignments are off', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: {} });
    render(<AppAssignmentsPage />);
    expect(await screen.findByText('Uygulama atamaları açık değil')).toBeInTheDocument();
    expect(appsApi.assignments).not.toHaveBeenCalled();
  });
});
