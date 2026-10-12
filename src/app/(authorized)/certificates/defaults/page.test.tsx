import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import CertificateDefaultsPage from '@/app/(authorized)/certificates/defaults/page';
import { certificatesApi } from '@/lib/api/certificates';

const mockAuth = { user: { id: 'yk', groups: ['/UYELER/YK'], roles: [] } };
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/lib/api/teams', () => ({
  teamsApi: { list: jest.fn().mockResolvedValue([{ team: 'GECEKODU' }]) },
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
  });
});
