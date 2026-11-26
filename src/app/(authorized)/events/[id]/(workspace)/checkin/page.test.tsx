import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import EventCheckinPage from '@/app/(authorized)/events/[id]/(workspace)/checkin/page';
import { eventsApi } from '@/lib/api/events';
import { identityApi } from '@/lib/api/identity';
import { ticketsApi } from '@/lib/api/tickets';
import { saveEventWithSeason } from '@/lib/scheduling/save-event';
import {
  primeEventWorkspace,
  renderEventTab,
  signInAs,
  workspaceEvent,
} from '@/test/event-workspace';

jest.mock('next/navigation', () => jest.requireActual('@/test/event-workspace').navigationModule);
jest.mock('@/context/AuthContext', () => jest.requireActual('@/test/event-workspace').authModule);
jest.mock('@/lib/api/events', () => jest.requireActual('@/test/event-workspace').eventsModule);
jest.mock(
  '@/lib/api/eventDays',
  () => jest.requireActual('@/test/event-workspace').eventDaysModule,
);
jest.mock('@/lib/api/sessions', () =>
  jest.requireActual('@/test/event-workspace').sessionsModule(),
);
jest.mock('@/lib/api/tickets', () => jest.requireActual('@/test/event-workspace').ticketsModule);
jest.mock('@/lib/api/identity', () => jest.requireActual('@/test/event-workspace').identityModule);
jest.mock(
  '@/lib/api/competitors',
  () => jest.requireActual('@/test/event-workspace').competitorsModule,
);
jest.mock('@/lib/api/teams', () => jest.requireActual('@/test/event-workspace').teamsModule);
jest.mock('@/lib/api/seasons', () => jest.requireActual('@/test/event-workspace').seasonsModule);
jest.mock('@/lib/api/capabilities', () => ({
  capabilitiesApi: { get: jest.fn(() => Promise.reject(new TypeError('Failed to fetch'))) },
}));
jest.mock('@/lib/scheduling/save-event', () =>
  jest.requireActual('@/test/event-workspace').saveEventModule(),
);

describe('Kapı', () => {
  beforeEach(primeEventWorkspace);

  it('opens the scanning page at its old address and keeps the door’s settings in cards', async () => {
    signInAs(['/UYELER/YK']);
    await renderEventTab(<EventCheckinPage />, '/events/e1/checkin');
    // The door staff's saved links keep working: the scanning stays at /door
    expect(await screen.findByRole('link', { name: 'Taramayı aç' })).toHaveAttribute(
      'href',
      '/events/e1/door',
    );
    expect(screen.getByRole('button', { name: 'Oturum QR' })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Kapı düzeni' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Kapı görevlileri' })).toBeInTheDocument();
  });

  it('saves the door staff by their card’s Kaydet, sending only them', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/YK']);
    (eventsApi.get as jest.Mock).mockResolvedValue({
      ...workspaceEvent,
      doorStaffIds: ['u1', 'u2'],
    });
    (identityApi.getUser as jest.Mock).mockImplementation((id: string) =>
      Promise.resolve({ id, firstName: id, lastName: 'Kişi', email: `${id}@example.com` }),
    );
    (saveEventWithSeason as jest.Mock).mockResolvedValueOnce('e1');
    await renderEventTab(<EventCheckinPage />, '/events/e1/checkin');
    const staff = await screen.findByRole('region', { name: 'Kapı görevlileri' });
    await user.click(within(staff).getAllByRole('button', { name: 'Kaldır' })[0]!);
    expect(within(staff).getByText('Kaydedilmemiş değişiklik var')).toBeInTheDocument();
    // The other card holds nothing
    expect(
      within(screen.getByRole('region', { name: 'Kapı düzeni' })).queryByRole('button', {
        name: 'Kaydet',
      }),
    ).toBeNull();
    await user.click(within(staff).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() =>
      expect(saveEventWithSeason).toHaveBeenCalledWith(
        expect.objectContaining({ doorStaffIds: ['u2'] }),
        'e1',
        expect.objectContaining({ doorStaffIds: ['u1', 'u2'] }),
        { notifyTicketHolders: false },
      ),
    );
  });

  it('shows door staff the scanning alone, without the settings', async () => {
    signInAs(['/UYELER/ARGE/WEBLAB']);
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([
      { id: 'e1', name: 'GeceKodu', ownerTeam: 'GECEKODU' },
    ]);
    await renderEventTab(<EventCheckinPage />, '/events/e1/checkin');
    expect(await screen.findByRole('link', { name: 'Taramayı aç' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Kapı düzeni' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Kapı görevlileri' })).not.toBeInTheDocument();
  });
});
