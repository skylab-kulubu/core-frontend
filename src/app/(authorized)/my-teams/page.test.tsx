import { render, screen } from '@testing-library/react';
import React from 'react';
import MyTeamsPage from '@/app/(authorized)/my-teams/page';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { identityApi } from '@/lib/api/identity';

jest.mock('@/lib/api/capabilities', () => ({
  capabilitiesApi: { get: jest.fn() },
}));
jest.mock('@/lib/api/identity', () => ({
  identityApi: { managedGroups: jest.fn() },
}));

const WEBLAB = {
  id: 'g-web',
  code: 'WEBLAB',
  path: '/UYELER/ARGE/WEBLAB',
  displayName: { tr: 'Web Geliştirme' },
  memberCount: 12,
  can: { 'group.read': true, 'members.write': true, 'leaders.write': false },
  children: [
    {
      id: 'g-mob',
      code: 'MOBIL',
      path: '/UYELER/ARGE/WEBLAB/MOBIL',
      memberCount: 4,
      can: { 'group.read': true, 'members.write': true, 'leaders.write': true },
      children: [],
    },
  ],
};

describe('Ekiplerim', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists the led Teams and the Teams below them, each opening under Ekiplerim', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      managedTeams: [{ id: 'g-web', path: '/UYELER/ARGE/WEBLAB', code: 'WEBLAB' }],
    });
    (identityApi.managedGroups as jest.Mock).mockResolvedValue([WEBLAB]);
    render(<MyTeamsPage />);
    const web = await screen.findByRole('link', { name: /Web Geliştirme/ });
    expect(web).toHaveAttribute('href', '/my-teams/g-web');
    expect(screen.getByText('/UYELER/ARGE/WEBLAB · 12 üye')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /— MOBIL/ })).toHaveAttribute(
      'href',
      '/my-teams/g-mob',
    );
  });

  it('reads no tree when core names no managed Team', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ managedTeams: [] });
    render(<MyTeamsPage />);
    expect(await screen.findByText('Yönettiğin ekip yok')).toBeInTheDocument();
    expect(identityApi.managedGroups).not.toHaveBeenCalled();
  });

  it('says the tree could not be read', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      managedTeams: [{ id: 'g-web', path: '/UYELER/ARGE/WEBLAB', code: 'WEBLAB' }],
    });
    (identityApi.managedGroups as jest.Mock).mockRejectedValue(new Error('down'));
    render(<MyTeamsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Ekipler yüklenemedi');
  });
});
