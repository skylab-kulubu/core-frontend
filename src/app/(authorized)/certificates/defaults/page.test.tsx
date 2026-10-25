import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import CertificateDefaultsPage from '@/app/(authorized)/certificates/defaults/page';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { certificatesApi } from '@/lib/api/certificates';
import { teamsApi } from '@/lib/api/teams';
import { ProblemError } from '@/lib/api/core';

const mockAuth = { user: { id: 'yk', groups: ['/UYELER/YK'], roles: [] } };
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/lib/api/teams', () => ({
  teamsApi: { list: jest.fn().mockResolvedValue([{ team: 'GECEKODU' }]) },
}));
// Unreadable unless a test sets core's answer (the group rule stands)
jest.mock('@/lib/api/capabilities', () => ({
  capabilitiesApi: { get: jest.fn(() => Promise.reject(new TypeError('Failed to fetch'))) },
}));
jest.mock('@/lib/api/certificates', () => ({
  certificatesApi: {
    templates: jest.fn(),
    bindings: jest.fn(),
    setBinding: jest.fn(),
    clearBinding: jest.fn(),
  },
}));

describe('Certificate defaults: remove a team default', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (certificatesApi.templates as jest.Mock).mockResolvedValue([
      { id: 't1', name: 'GECEKODU', ownerTeam: 'GECEKODU', publishedVersion: { version: 1 } },
    ]);
    (certificatesApi.bindings as jest.Mock).mockResolvedValue([
      { id: 'b1', scope: 'ownerTeam', scopeKey: 'GECEKODU', templateId: 't1', updatedAt: '' },
    ]);
    (certificatesApi.clearBinding as jest.Mock).mockResolvedValue(undefined);
  });

  it('asks in a dialog that names the team and what follows', async () => {
    const user = userEvent.setup();
    render(<CertificateDefaultsPage />);
    await user.click(await screen.findByRole('button', { name: 'Ekip varsayılanını kaldır' }));
    const confirm = await screen.findByRole('alertdialog', {
      name: 'GECEKODU varsayılanı kaldırılsın mı?',
    });
    expect(confirm).toHaveTextContent('SKY LAB varsayılanını kullanır');
    await user.click(within(confirm).getByRole('button', { name: 'Vazgeç' }));
    expect(certificatesApi.clearBinding).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Ekip varsayılanını kaldır' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Varsayılanı kaldır',
      }),
    );
    await waitFor(() =>
      expect(certificatesApi.clearBinding).toHaveBeenCalledWith('ownerTeam', 'GECEKODU'),
    );
    // A finished write is a toast, not a status line on the page
    expect(
      await screen.findByText('GECEKODU varsayılanı kaldırıldı; SKY LAB varsayılanı geçerli.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('says a refused removal inside the dialog, which stays open', async () => {
    const user = userEvent.setup();
    (certificatesApi.clearBinding as jest.Mock).mockRejectedValue(
      new ProblemError(403, 'Forbidden', { detail: 'missing role certificate:bind' }),
    );
    render(<CertificateDefaultsPage />);
    await user.click(await screen.findByRole('button', { name: 'Ekip varsayılanını kaldır' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Varsayılanı kaldır' }));
    expect(await within(confirm).findByRole('alert')).toHaveTextContent(
      'Bu işlem için yetkin yok.',
    );
    expect(confirm).not.toHaveTextContent(/Forbidden|missing role/);
  });
});

describe('Certificate defaults: the teams to choose from', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => {
    mockAuth.user.groups = ['/UYELER/YK'];
  });

  it('adds a Sub-team core says the Leader leads, without reading the page again', async () => {
    mockAuth.user.groups = ['/UYELER/ARGE/WEBLAB/LIDERLER'];
    (teamsApi.list as jest.Mock).mockResolvedValue([
      { team: 'GECEKODU' },
      { team: 'WEBLAB' },
      { team: 'MOBIL' },
    ]);
    (certificatesApi.templates as jest.Mock).mockResolvedValue([]);
    (certificatesApi.bindings as jest.Mock).mockResolvedValue([]);
    let answer: (value: unknown) => void = () => undefined;
    (capabilitiesApi.get as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    render(<CertificateDefaultsPage />);
    await waitFor(() => expect(teamsApi.list).toHaveBeenCalledTimes(1));
    answer({
      teams: [
        { team: 'MOBIL', levels: ['LEADER'], can: {} },
        { team: 'WEBLAB', levels: ['LEADER', 'MEMBER'], can: {} },
      ],
    });
    expect(await screen.findByRole('option', { name: 'MOBIL' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'WEBLAB' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'GECEKODU' })).toBeNull();
    expect(teamsApi.list).toHaveBeenCalledTimes(1);
    expect(certificatesApi.templates).toHaveBeenCalledTimes(1);
  });
});
