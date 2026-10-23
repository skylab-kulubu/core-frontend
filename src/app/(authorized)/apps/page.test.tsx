import { render, screen } from '@testing-library/react';
import React from 'react';
import AppsPage from '@/app/(authorized)/apps/page';
import { appsApi } from '@/lib/api/apps';
import { capabilitiesApi } from '@/lib/api/capabilities';

jest.mock('@/lib/api/capabilities', () => ({ capabilitiesApi: { get: jest.fn() } }));
jest.mock('@/lib/api/apps', () => ({ appsApi: { list: jest.fn() } }));

beforeEach(() => {
  jest.clearAllMocks();
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
  it('lists each app with whether it needs an assignment and its counts', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'apps.read': true } });
    render(<AppsPage />);
    const forms = await screen.findByRole('link', { name: /SkyForms/ });
    expect(forms).toHaveAttribute('href', '/apps/forms');
    expect(screen.getByText('forms · Atama gerekli: Evet')).toBeInTheDocument();
    expect(screen.getByText('3 grup · 1 kişi')).toBeInTheDocument();
    expect(screen.getByText('core · Atama gerekli: Hayır')).toBeInTheDocument();
  });

  it('reads nothing while core’s app assignments are off', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'apps.read': false } });
    render(<AppsPage />);
    expect(await screen.findByText('Uygulama atamaları açık değil')).toBeInTheDocument();
    expect(appsApi.list).not.toHaveBeenCalled();
  });
});
