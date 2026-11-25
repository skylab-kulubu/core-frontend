import { screen, within } from '@testing-library/react';
import React from 'react';
import EventCertificatesPage from '@/app/(authorized)/events/[id]/(workspace)/certificates/page';
import { certificatesApi } from '@/lib/api/certificates';
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
jest.mock('@/lib/api/certificates', () => ({
  certificatesApi: {
    summary: jest.fn(),
    templates: jest.fn().mockResolvedValue([]),
    listIssued: jest.fn().mockResolvedValue([]),
    rule: jest.fn(() => Promise.reject(new Error('404'))),
    attendance: jest.fn(),
    eventTemplate: jest.fn(),
    resolve: jest.fn(),
  },
}));

describe('Event Sertifikalar tab', () => {
  beforeEach(primeEventWorkspace);

  it('keeps the certificates from a reader who opens the tab by its address', async () => {
    signInAs(['/UYELER/ARGE/WEBLAB']);
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([
      { id: 'e1', name: 'GeceKodu', ownerTeam: 'GECEKODU' },
    ]);
    await renderEventTab(<EventCertificatesPage />, '/events/e1/certificates');
    expect(await screen.findByText('Bu sayfaya erişimin yok')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sertifikalar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Sertifikalar' })).not.toBeInTheDocument();
  });

  it('shows who edits the event, without a certificate role, the rule and the template only', async () => {
    // A GECEKODU member: the team's rule lets members edit its events
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU']);
    (certificatesApi.eventTemplate as jest.Mock).mockResolvedValue({
      resolution: {
        source: 'ownerTeam',
        template: {
          id: 't-team',
          name: 'GECEKODU sertifikası',
          ownerTeam: 'GECEKODU',
          system: false,
        },
        version: { version: 2 },
      },
      eventTemplate: null,
      choices: [],
    });
    await renderEventTab(<EventCertificatesPage />, '/events/e1/certificates');

    const menu = screen.getByRole('navigation', { name: 'Etkinlik' });
    expect(within(menu).getByRole('link', { name: /^Sertifikalar/ })).toBeInTheDocument();
    expect(await screen.findByText('GECEKODU ekip şablonu · v2')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Etkinliğe özel şablon oluştur' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ekip şablonlarından seç' })).toBeInTheDocument();
    // Issuing and the figures stay with the certificate roles
    expect(screen.queryByRole('button', { name: /Katılımı kapat/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Elle ver' })).not.toBeInTheDocument();
    expect(certificatesApi.summary).not.toHaveBeenCalled();
    expect(certificatesApi.attendance).not.toHaveBeenCalled();
  });
});
