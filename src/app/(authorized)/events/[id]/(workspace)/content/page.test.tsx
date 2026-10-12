import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import EventContentPage from '@/app/(authorized)/events/[id]/(workspace)/content/page';
import { eventsApi } from '@/lib/api/events';
import { ticketsApi } from '@/lib/api/tickets';
import { eventMediaApi } from '@/lib/api/uploads';
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
jest.mock('@/lib/api/uploads', () => ({
  ...jest.requireActual('@/lib/api/uploads'),
  eventMediaApi: { remove: jest.fn() },
}));
jest.mock('@/lib/scheduling/save-event', () =>
  jest.requireActual('@/test/event-workspace').saveEventModule(),
);

describe('Event İçerik tab', () => {
  beforeEach(primeEventWorkspace);

  it('says there is nothing to show to a reader who cannot add files to an empty event', async () => {
    signInAs(['/UYELER/ARGE/WEBLAB']);
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([
      { id: 'e1', name: 'GeceKodu', ownerTeam: 'GECEKODU' },
    ]);
    await renderEventTab(<EventContentPage />, '/events/e1/content');
    expect(await screen.findByText('Bu etkinlikte dosya ya da video yok')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'İçerik' })).not.toBeInTheDocument();
  });

  it('says a file was removed from the event', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    const slides = {
      id: 'f1',
      name: 'sunum.pdf',
      type: 'application/pdf',
      size: 1024,
      status: 'ready',
    };
    (eventsApi.get as jest.Mock).mockResolvedValue({ ...workspaceEvent, files: [slides] });
    (eventMediaApi.remove as jest.Mock).mockResolvedValue({ ...workspaceEvent, files: [] });
    await renderEventTab(<EventContentPage />, '/events/e1/content');
    await user.click(await screen.findByRole('button', { name: 'Kaldır' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Kaldır' }));
    await waitFor(() => expect(eventMediaApi.remove).toHaveBeenCalledWith('e1', 'files', ['f1']));
    expect(await screen.findByText('sunum.pdf kaldırıldı')).toBeInTheDocument();
  });
});
