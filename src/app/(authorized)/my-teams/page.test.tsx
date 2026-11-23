import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import MyTeamsPage from '@/app/(authorized)/my-teams/page';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { identityApi } from '@/lib/api/identity';

const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));
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
  leaderCount: 2,
  can: { 'group.read': true, 'members.write': true, 'leaders.write': false },
  children: [
    {
      id: 'g-mob',
      code: 'MOBIL',
      path: '/UYELER/ARGE/WEBLAB/MOBIL',
      memberCount: 4,
      leaderCount: 0,
      can: { 'group.read': true, 'members.write': true, 'leaders.write': true },
      children: [],
    },
  ],
};
const AILAB = {
  ...WEBLAB,
  id: 'g-ai',
  code: 'AI-LAB',
  displayName: { tr: 'AI Lab' },
  children: [],
};

describe('Ekibim', () => {
  beforeEach(() => jest.clearAllMocks());

  it('takes the Leader of one Team straight to its page', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      managedTeams: [{ id: 'g-web', path: '/UYELER/ARGE/WEBLAB', code: 'WEBLAB' }],
    });
    (identityApi.managedGroups as jest.Mock).mockResolvedValue([WEBLAB]);
    render(<MyTeamsPage />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/my-teams/g-web'));
  });

  it('gives the Leader of several Teams a card for each, the Teams below them included', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      managedTeams: [{ id: 'g-web', path: '/UYELER/ARGE/WEBLAB', code: 'WEBLAB' }],
    });
    (identityApi.managedGroups as jest.Mock).mockResolvedValue([WEBLAB, AILAB]);
    render(<MyTeamsPage />);
    const web = await screen.findByRole('link', { name: /Web Geliştirme/ });
    expect(web).toHaveAttribute('href', '/my-teams/g-web');
    expect(web).toHaveTextContent('12 üye · 2 lider · 1 alt ekip');
    const mobil = screen.getByRole('link', { name: /MOBIL/ });
    expect(mobil).toHaveAttribute('href', '/my-teams/g-mob');
    expect(mobil).toHaveTextContent('WEBLAB altında');
    expect(mobil).toHaveTextContent('Lider yok');
    expect(mockReplace).not.toHaveBeenCalled();
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
    expect(await screen.findByText('Ekipler yüklenemedi')).toBeInTheDocument();
  });
});
