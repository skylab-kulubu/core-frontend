import { screen } from '@testing-library/react';
import React from 'react';
import EventCertificatesPage from '@/app/(authorized)/events/[id]/(workspace)/certificates/page';
import { ticketsApi } from '@/lib/api/tickets';
import { primeEventWorkspace, renderEventTab, signInAs } from '@/test/event-workspace';

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
jest.mock('@/lib/scheduling/save-event', () =>
  jest.requireActual('@/test/event-workspace').saveEventModule(),
);

describe('Event Sertifikalar tab', () => {
  beforeEach(primeEventWorkspace);

  it('keeps the certificates from a reader who opens the tab by its address', async () => {
    signInAs(['/UYELER/ARGE/WEBLAB']);
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([
      { id: 'e1', name: 'GeceKodu', ownerTeam: 'GECEKODU' },
    ]);
    await renderEventTab(<EventCertificatesPage />, '/events/e1/certificates');
    expect(await screen.findByText('Sertifikaları görme yetkin yok')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sertifikalar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Sertifikalar' })).not.toBeInTheDocument();
  });
});
