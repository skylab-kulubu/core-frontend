import { render, screen, within } from '@testing-library/react';
import React from 'react';
import AppsPage from '@/app/(authorized)/apps/page';
import { appsApi } from '@/lib/api/apps';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { sceneTitle } from '@/test/error-scenes';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/apps',
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
jest.mock('@/lib/api/capabilities', () => ({ capabilitiesApi: { get: jest.fn() } }));
jest.mock('@/lib/api/apps', () => ({ appsApi: { list: jest.fn() } }));

beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState(null, '', '/apps');
  (appsApi.list as jest.Mock).mockResolvedValue([
    {
      clientId: 'forms',
      name: 'SkyForms',
      assignmentRequired: true,
      roles: ['skyforms:access'],
      suggestedRoles: ['skyforms:access'],
      groups: 3,
      users: 1,
    },
    {
      clientId: 'core',
      name: 'Panel: kısa link ve sertifika',
      assignmentRequired: false,
      roles: ['url:access'],
      suggestedRoles: [],
      groups: 0,
      users: 0,
    },
  ]);
});

describe('Uygulamalar', () => {
  it('lists each app with who may open it and its assignments, the id left to its page', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'apps.read': true } });
    render(<AppsPage />);
    const forms = await screen.findByRole('link', { name: 'SkyForms' });
    expect(forms).toHaveAttribute('href', '/apps/forms');
    expect(screen.getByText('3 grup · 1 kişi')).toBeInTheDocument();
    expect(screen.getByText('Atama yok')).toBeInTheDocument();
    expect(screen.getAllByText('Yalnız atananlar').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Herkese açık').length).toBeGreaterThan(0);
    // The raw id and the old "Atama gerekli" words are gone from the list
    expect(screen.queryByText(/Atama gerekli/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^forms ·/)).not.toBeInTheDocument();
    const figures = screen.getByRole('group', { name: 'Özet' });
    expect(within(figures).getByRole('button', { name: /Uygulama\s*2/ })).toBeInTheDocument();
    expect(within(figures).getByText('Grup ataması')).toBeInTheDocument();
  });

  it('says the page is closed while core’s app assignments are off, and reads nothing', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'apps.read': false } });
    render(<AppsPage />);
    expect(
      await screen.findByRole('heading', { name: sceneTitle('forbidden') }),
    ).toBeInTheDocument();
    expect(appsApi.list).not.toHaveBeenCalled();
  });
});
