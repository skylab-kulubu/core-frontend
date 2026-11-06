import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import EventsPage from '@/app/(authorized)/events/page';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { eventsApi, type CoreEvent } from '@/lib/api/events';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', groups: [], roles: [] } }),
}));
jest.mock('@/components/scheduling/NewEventProvider', () => ({
  useNewEvent: () => ({ open: jest.fn(), canCreate: false }),
}));
jest.mock('@/lib/api/events', () => ({
  eventsApi: { list: jest.fn(), copy: jest.fn(), listCompetitions: jest.fn() },
}));
jest.mock('@/lib/api/teams', () => ({ teamsApi: { list: jest.fn() } }));
jest.mock('@/lib/api/capabilities', () => ({ capabilitiesApi: { get: jest.fn() } }));

const past: CoreEvent = {
  id: 'p',
  name: 'Eski Kodu',
  description: '',
  location: 'YTÜ',
  ownerTeam: 'GECEKODU',
  capacity: 0,
  active: false,
  ranked: false,
  status: 'published',
  startDate: '2020-10-01T10:00:00+03:00',
  createdAt: '',
  updatedAt: '',
};

function capabilities(create: boolean) {
  (capabilitiesApi.get as jest.Mock).mockResolvedValue({
    teams: [{ team: 'GECEKODU', can: { 'event.create': create, 'event.update': false } }],
  });
}

describe('Etkinlikler listesi: Kopyala…', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (eventsApi.list as jest.Mock).mockResolvedValue([past]);
    (eventsApi.listCompetitions as jest.Mock).mockResolvedValue([]);
  });

  it('copies an ended event from its row and opens the copy', async () => {
    capabilities(true);
    (eventsApi.copy as jest.Mock).mockResolvedValue({
      event: { ...past, id: 'c1', status: 'draft' },
      skipped: [],
    });
    const user = userEvent.setup();
    render(<EventsPage />);
    await user.click(await screen.findByRole('button', { name: 'Eski Kodu: eylemler' }));
    const menu = await screen.findByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Kopyala…']);
    await user.click(within(menu).getByRole('menuitem', { name: 'Kopyala…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Etkinliği kopyala' });
    await user.click(within(dialog).getByRole('button', { name: 'Kopyala' }));
    expect(eventsApi.copy).toHaveBeenCalledWith(
      'p',
      expect.objectContaining({ name: 'Eski Kodu (kopya)' }),
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/events/c1'));
  });

  it('has no Kopyala for a reader core lets create nothing', async () => {
    capabilities(false);
    render(<EventsPage />);
    await screen.findByRole('link', { name: 'Eski Kodu' });
    await waitFor(() => expect(capabilitiesApi.get).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Eski Kodu: eylemler' })).not.toBeInTheDocument();
  });
});
