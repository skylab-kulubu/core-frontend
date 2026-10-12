import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import NewCompetitorPage from '@/app/(authorized)/events/[id]/competition/new/page';
import { competitorsApi } from '@/lib/api/competitors';
import { eventsApi } from '@/lib/api/events';
import { identityApi } from '@/lib/api/identity';

const mockPush = jest.fn();
const mockAuth = { user: { id: 'yk', groups: ['/UYELER/YK'], roles: [] } };

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/lib/api/events', () => ({ eventsApi: { get: jest.fn() } }));
jest.mock('@/lib/api/competitors', () => ({ competitorsApi: { create: jest.fn() } }));
jest.mock('@/lib/api/identity', () => ({
  identityApi: { listUsers: jest.fn(), getUser: jest.fn() },
}));

describe('Event Yarışma: new competitor', () => {
  it('adds the competitor to the event in the address and returns to its tab', async () => {
    const user = userEvent.setup();
    (eventsApi.get as jest.Mock).mockResolvedValue({
      id: 'e1',
      name: 'GeceKodu',
      ownerTeam: 'GECEKODU',
    });
    const ada = { id: 'u-ada', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' };
    (identityApi.listUsers as jest.Mock).mockResolvedValue([ada]);
    (identityApi.getUser as jest.Mock).mockResolvedValue(ada);
    (competitorsApi.create as jest.Mock).mockResolvedValue({ id: 'c1' });
    await act(async () => {
      render(<NewCompetitorPage params={Promise.resolve({ id: 'e1' })} />);
    });
    expect(await screen.findByText('GeceKodu')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Kişi seç' }));
    await user.type(screen.getByPlaceholderText('Ad, e-posta'), 'Ada');
    await user.click(await screen.findByRole('button', { name: 'Ada Lovelace' }));
    await user.type(screen.getByLabelText('Puan'), '87');
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));

    await waitFor(() =>
      expect(competitorsApi.create).toHaveBeenCalledWith({
        userId: 'u-ada',
        eventId: 'e1',
        score: 87,
        isWinner: false,
      }),
    );
    expect(mockPush).toHaveBeenCalledWith('/events/e1/competition');
    expect(await screen.findByText('Yarışmacı eklendi')).toBeInTheDocument();
  });
});
