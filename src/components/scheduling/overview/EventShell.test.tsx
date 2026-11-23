import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import EventOverviewPage from '@/app/(authorized)/events/[id]/(workspace)/page';
import EventProgramPage from '@/app/(authorized)/events/[id]/(workspace)/program/page';
import { certificatesApi } from '@/lib/api/certificates';
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
    const commands = screen.getByRole('group', { name: 'Etkinlik komutları' });
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

    const commands = await screen.findByRole('group', { name: 'Etkinlik komutları' });
    const buttons = within(commands).getAllByRole('link');
    expect(buttons[0]).toHaveAccessibleName('Kapı');
    expect(buttons[0].className).toContain('bg-skylab-500/10');
  });

  it('shows a cover that cannot be loaded as the initials', async () => {
    (eventsApi.get as jest.Mock).mockResolvedValue({
      ...workspaceEvent,
      coverImageUrl: 'https://cdn.example/yok.png',
    });
    signInAs(LEADER);
    await renderEventTab(<EventOverviewPage />);
    await screen.findByRole('heading', { level: 1, name: 'GeceKodu' });
    const header = document.querySelector('[data-slot="object-page-header"]') as HTMLElement;
    const shown = [...header.querySelectorAll('img')].find((img) =>
      img.classList.contains('object-contain'),
    ) as HTMLImageElement;
    fireEvent.error(shown);
    await waitFor(() =>
      expect(header.querySelector('[data-slot="object-cover-placeholder"]')).toHaveTextContent('G'),
    );
  });

  describe('closing attendance on the overview', () => {
    const ended = (rule: string) => ({
      ...workspaceEvent,
      status: 'published',
      active: false,
      attendanceRule: rule,
      startDate: '2026-01-10T10:00:00+03:00',
      endDate: '2026-01-10T12:00:00+03:00',
    });
    const summary = (finalizedAt?: string) => ({
      eventId: 'e1',
      attendanceFinalizedAt: finalizedAt,
      eligibleCount: 3,
      issuedCount: 3,
      revokedCount: 0,
      queuedCount: 0,
      failedCount: 0,
      resolution: {},
    });

    it('asks to close attendance after an event with a rule, until it is closed', async () => {
      (eventsApi.get as jest.Mock).mockResolvedValue(ended('once'));
      (certificatesApi.summary as jest.Mock).mockResolvedValue(summary());
      signInAs(LEADER);
      await renderEventTab(<EventOverviewPage />);
      expect(await screen.findByRole('link', { name: /Katılımı kapat/ })).toHaveAttribute(
        'href',
        '/events/e1/certificates',
      );
    });

    it('says nothing once attendance is closed and every certificate went out', async () => {
      (eventsApi.get as jest.Mock).mockResolvedValue(ended('once'));
      (certificatesApi.summary as jest.Mock).mockResolvedValue(summary('2026-01-11T10:00:00Z'));
      signInAs(LEADER);
      await renderEventTab(<EventOverviewPage />);
      await screen.findByRole('heading', { name: 'Yapılacaklar' });
      await waitFor(() => expect(certificatesApi.summary).toHaveBeenCalled());
      expect(screen.queryByRole('link', { name: /Katılımı kapat/ })).not.toBeInTheDocument();
      expect(screen.queryByText(/sertifika verilmedi/)).not.toBeInTheDocument();
    });

    it('asks nothing of an event without a certificate rule', async () => {
      (eventsApi.get as jest.Mock).mockResolvedValue(ended('none'));
      (certificatesApi.summary as jest.Mock).mockResolvedValue(summary());
      signInAs(LEADER);
      await renderEventTab(<EventOverviewPage />);
      await screen.findByRole('heading', { name: 'Yapılacaklar' });
      await waitFor(() => expect(certificatesApi.summary).toHaveBeenCalled());
      expect(screen.queryByRole('link', { name: /Katılımı kapat/ })).not.toBeInTheDocument();
    });
  });
});
