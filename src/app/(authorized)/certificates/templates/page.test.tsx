import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import CertificateTemplatesPage from '@/app/(authorized)/certificates/templates/page';
import { certificatesApi } from '@/lib/api/certificates';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  usePathname: () => '/certificates/templates',
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'yk', groups: ['/UYELER/YK'], roles: [] } }),
}));
jest.mock('@/lib/api/capabilities', () => ({
  capabilitiesApi: { get: jest.fn(() => Promise.reject(new TypeError('Failed to fetch'))) },
}));
jest.mock('@/lib/api/media', () => ({ mediaApi: { get: jest.fn() } }));
jest.mock('@/lib/api/certificates', () => ({
  certificatesApi: { templates: jest.fn(), bindings: jest.fn() },
}));

const layout = {
  width: 1123,
  height: 794,
  orientation: 'landscape',
  backgroundColor: '#fff',
  elements: [],
};

beforeEach(() => {
  window.history.replaceState(null, '', '/certificates/templates');
  (certificatesApi.templates as jest.Mock).mockResolvedValue([
    {
      id: 't0',
      name: 'Kulüp şablonu',
      ownerTeam: '',
      system: true,
      draftLayout: layout,
      publishedVersion: { version: 3, layout, publishedAt: '2026-11-01T10:00:00Z' },
    },
    { id: 't1', name: 'GeceKodu taslağı', ownerTeam: 'GECEKODU', draftLayout: layout },
  ]);
  (certificatesApi.bindings as jest.Mock).mockResolvedValue([
    { id: 'b0', scope: 'club', scopeKey: 'SKY_LAB', templateId: 't0', updatedAt: '' },
    { id: 'b1', scope: 'ownerTeam', scopeKey: 'WEBLAB', templateId: 't0', updatedAt: '' },
  ]);
});

describe('Certificate templates', () => {
  it('shows each template as a card: picture, owner, state and where it is the default', async () => {
    render(<CertificateTemplatesPage />);
    const card = (await screen.findByText('Kulüp şablonu')).closest('a') as HTMLElement;
    expect(card).toHaveAttribute('href', '/certificates/templates/t0');
    expect(card).toHaveTextContent('Yayında · v3');
    expect(card).toHaveTextContent('Kulüp varsayılanı');
    expect(card).toHaveTextContent('WEBLAB varsayılanı');
    expect(card).toHaveTextContent('Kulüp geneli');
    expect(screen.getByText('GeceKodu taslağı').closest('a')).toHaveTextContent('Taslak');
  });

  it('narrows to the drafts', async () => {
    const user = userEvent.setup();
    render(<CertificateTemplatesPage />);
    await screen.findByText('Kulüp şablonu');
    await user.click(screen.getByRole('button', { name: /^Taslak/ }));
    expect(window.location.search).toBe('?view=draft');
  });

  it('keeps the cards when the defaults cannot be read', async () => {
    (certificatesApi.bindings as jest.Mock).mockRejectedValue(new Error('403'));
    render(<CertificateTemplatesPage />);
    expect(await screen.findByText('Kulüp şablonu')).toBeInTheDocument();
    expect(screen.queryByText('Kulüp varsayılanı')).not.toBeInTheDocument();
  });
});
