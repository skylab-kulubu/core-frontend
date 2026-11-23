import { screen, within } from '@testing-library/react';
import React from 'react';
import EventOverviewPage from '@/app/(authorized)/events/[id]/(workspace)/page';
import EventProgramPage from '@/app/(authorized)/events/[id]/(workspace)/program/page';
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

describe('event pages on trial (?tasarim=a|b)', () => {
  beforeEach(primeEventWorkspace);
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('draws no tab line in A: a command bar, the event menu and the essentials', async () => {
    window.history.replaceState(null, '', '/events/e1?tasarim=a');
    signInAs(LEADER);
    await renderEventTab(<EventOverviewPage />);

    expect(await screen.findByRole('heading', { name: 'Temel bilgiler' })).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    const commands = screen.getByRole('toolbar', { name: 'Etkinlik komutları' });
    expect(within(commands).getByRole('link', { name: 'Düzenle' })).toHaveAttribute(
      'href',
      '/events/e1/edit?tasarim=a',
    );
    expect(within(commands).getByRole('link', { name: 'Kapı' })).toHaveAttribute(
      'href',
      '/events/e1/door',
    );
    const menu = screen.getAllByRole('navigation', { name: 'Etkinlik' })[0];
    // Every page keeps the direction on trial
    expect(within(menu).getByRole('link', { name: /Program/ })).toHaveAttribute(
      'href',
      '/events/e1/program?tasarim=a',
    );
  });

  it('names the open page beside the event in A', async () => {
    window.history.replaceState(null, '', '/events/e1/program?tasarim=a');
    signInAs(LEADER);
    await renderEventTab(<EventProgramPage />, '/events/e1/program');

    expect(
      await screen.findByRole('heading', { level: 1, name: /GeceKodu \| Program/ }),
    ).toBeInTheDocument();
  });

  it('marks the open page among the pills in B, with the door beside the actions', async () => {
    window.history.replaceState(null, '', '/events/e1/program?tasarim=b');
    signInAs(LEADER);
    await renderEventTab(<EventProgramPage />, '/events/e1/program');

    const pills = await screen.findByRole('navigation', { name: 'Etkinlik' });
    expect(within(pills).getByRole('link', { name: /Program/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(pills).getByRole('link', { name: /Genel bakış/ })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByRole('link', { name: 'Kapıyı aç' })).toHaveAttribute(
      'href',
      '/events/e1/door',
    );
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('keeps the tab line without the switch', async () => {
    signInAs(LEADER);
    await renderEventTab(<EventOverviewPage />);
    expect(await screen.findByRole('tab', { name: 'Genel bakış' })).toBeInTheDocument();
    expect(screen.queryByRole('toolbar', { name: 'Etkinlik komutları' })).not.toBeInTheDocument();
  });
});
