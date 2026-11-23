import { screen, within } from '@testing-library/react';
import React from 'react';
import EventOverviewPage from '@/app/(authorized)/events/[id]/(workspace)/page';
import EventProgramPage from '@/app/(authorized)/events/[id]/(workspace)/program/page';
import { eventsApi } from '@/lib/api/events';
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
jest.mock('@/lib/api/certificates', () => ({
  certificatesApi: { summary: jest.fn(() => Promise.reject(new Error('no'))) },
}));
jest.mock('@/lib/scheduling/save-event', () =>
  jest.requireActual('@/test/event-workspace').saveEventModule(),
);

const LEADER = ['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER'];

describe('event object page', () => {
  beforeEach(primeEventWorkspace);

  it('has a command bar, the event menu and the essentials, no tab line', async () => {
    signInAs(LEADER);
    await renderEventTab(<EventOverviewPage />);

    expect(await screen.findByRole('heading', { name: 'Temel bilgiler' })).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    const commands = screen.getByRole('toolbar', { name: 'Etkinlik komutları' });
    expect(within(commands).getByRole('link', { name: 'Düzenle' })).toHaveAttribute(
      'href',
      '/events/e1/edit',
    );
    expect(within(commands).getByRole('link', { name: 'Kapı' })).toHaveAttribute(
      'href',
      '/events/e1/door',
    );
    const menu = screen.getAllByRole('navigation', { name: 'Etkinlik' })[0];
    expect(within(menu).getByRole('link', { name: /Program/ })).toHaveAttribute(
      'href',
      '/events/e1/program',
    );
  });

  it('names the open page beside the event', async () => {
    signInAs(LEADER);
    await renderEventTab(<EventProgramPage />, '/events/e1/program');

    const title = await screen.findByRole('heading', { level: 1, name: 'GeceKodu' });
    expect(title.parentElement).toHaveTextContent('GeceKodu| Program');
  });

  it('draws the door as the main command while the event runs', async () => {
    const now = Date.now();
    (eventsApi.get as jest.Mock).mockResolvedValue({
      ...workspaceEvent,
      status: 'published',
      active: true,
      startDate: new Date(now - 3600_000).toISOString(),
      endDate: new Date(now + 3600_000).toISOString(),
    });
    signInAs(LEADER);
    await renderEventTab(<EventOverviewPage />);

    const commands = await screen.findByRole('toolbar', { name: 'Etkinlik komutları' });
    const buttons = within(commands).getAllByRole('link');
    expect(buttons[0]).toHaveAccessibleName('Kapı');
    expect(buttons[0].className).toContain('bg-skylab-500/10');
  });
});
