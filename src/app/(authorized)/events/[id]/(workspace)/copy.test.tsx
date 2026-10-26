import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import EventOverviewPage from '@/app/(authorized)/events/[id]/(workspace)/page';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { eventsApi } from '@/lib/api/events';
import { copySkippedStorageKey } from '@/lib/event-copy';
import {
  primeEventWorkspace,
  renderEventTab,
  signInAs,
  workspaceEvent,
  workspaceRouter,
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
jest.mock('@/lib/api/capabilities', () => ({ capabilitiesApi: { get: jest.fn() } }));
jest.mock('@/lib/scheduling/save-event', () =>
  jest.requireActual('@/test/event-workspace').saveEventModule(),
);

const LEADER = ['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER'];
const FORM_A = '11111111-1111-4111-8111-111111111111';
const FORM_B = '22222222-2222-4222-8222-222222222222';
const formUrl = (id: string) => `https://forms.yildizskylab.com/${id}`;

function capabilities(can: Record<string, boolean>) {
  (capabilitiesApi.get as jest.Mock).mockResolvedValue({ teams: [{ team: 'GECEKODU', can }] });
}

/** The page opens e1, a copy of `src`, whose application and extra form are in Skyforms. */
function opensCopy(copy: Record<string, unknown> = {}) {
  (eventsApi.get as jest.Mock).mockImplementation(async (id: string) =>
    id === 'src'
      ? {
          ...workspaceEvent,
          id: 'src',
          formUrl: formUrl(FORM_A),
          extraFormUrls: [{ label: 'Mentor formu', url: formUrl(FORM_B) }],
        }
      : { ...workspaceEvent, id, name: 'GeceKodu (kopya)', copiedFromEventId: 'src', ...copy },
  );
}

describe('Etkinlik sayfası: kopya', () => {
  beforeEach(() => {
    primeEventWorkspace();
    sessionStorage.clear();
    signInAs(LEADER);
    capabilities({ 'event.create': true, 'event.update': true, 'ticket.read': true });
  });

  it('copies from the "⋯" menu and opens the copy', async () => {
    (eventsApi.copy as jest.Mock).mockResolvedValue({
      event: { ...workspaceEvent, id: 'c1', status: 'draft' },
      skipped: [],
    });
    const user = userEvent.setup();
    await renderEventTab(<EventOverviewPage />);
    await screen.findByRole('heading', { name: 'GeceKodu' });
    await user.click(await screen.findByRole('button', { name: 'Diğer eylemler' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getAllByRole('menuitem')[0]).toHaveTextContent('Kopyala…');
    await user.click(within(menu).getByRole('menuitem', { name: 'Kopyala…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Etkinliği kopyala' });
    expect(within(dialog).getByDisplayValue('GeceKodu (kopya)')).toBeInTheDocument();
  });

  it('gives no Kopyala to a reader core lets create nothing', async () => {
    capabilities({ 'event.create': false, 'event.update': false, 'ticket.read': true });
    signInAs(['/UYELER/DK']);
    await renderEventTab(<EventOverviewPage />);
    await screen.findByRole('heading', { name: 'GeceKodu' });
    await waitFor(() => expect(capabilitiesApi.get).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Diğer eylemler' })).not.toBeInTheDocument();
  });

  it('says once on the copy what core left out', async () => {
    opensCopy();
    sessionStorage.setItem(copySkippedStorageKey('e1'), '["certificateTemplate","cover"]');
    await renderEventTab(<EventOverviewPage />);
    expect(
      await screen.findByText(
        'Sertifika şablonu bağlaması kopyalanmadı: bu ekipte şablon bağlama yetkin yok.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Kapak görseli kopyalanmadı.')).toBeInTheDocument();
    expect(sessionStorage.getItem(copySkippedStorageKey('e1'))).toBeNull();
  });

  it('offers a new form from each of the source’s Skyforms forms', async () => {
    opensCopy();
    await renderEventTab(<EventOverviewPage />);
    const apply = await screen.findByRole('link', {
      name: 'Geçen seferin formundan yeni form oluştur',
    });
    const applyUrl = new URL(apply.getAttribute('href') ?? '');
    expect(applyUrl.pathname).toBe('/admin/forms/new-form');
    expect(applyUrl.searchParams.get('fromForm')).toBe(FORM_A);
    expect(applyUrl.searchParams.get('eventId')).toBe('e1');
    expect(new URL(applyUrl.searchParams.get('returnTo') ?? '').searchParams.get('formSlot')).toBe(
      'apply',
    );
    const extra = screen.getByRole('link', {
      name: 'Geçen seferin formundan yeni form: Mentor formu',
    });
    expect(new URL(extra.getAttribute('href') ?? '').searchParams.get('fromForm')).toBe(FORM_B);
    expect(eventsApi.get).toHaveBeenCalledWith('src');
    expect(workspaceRouter.push).not.toHaveBeenCalled();
  });

  it('offers none once the copy has its own forms', async () => {
    opensCopy({
      formUrl: formUrl('33333333-3333-4333-8333-333333333333'),
      extraFormUrls: [
        { label: 'Mentor formu', url: formUrl('44444444-4444-4444-8444-444444444444') },
      ],
    });
    await renderEventTab(<EventOverviewPage />);
    await screen.findByRole('heading', { name: 'GeceKodu (kopya)' });
    await waitFor(() => expect(eventsApi.get).toHaveBeenCalledWith('src'));
    expect(screen.queryByRole('link', { name: /Geçen seferin formundan/ })).not.toBeInTheDocument();
  });

  it('offers none to a reader who may not edit the copy', async () => {
    capabilities({ 'event.create': false, 'event.update': false, 'ticket.read': true });
    signInAs(['/UYELER/DK']);
    opensCopy();
    await renderEventTab(<EventOverviewPage />);
    await screen.findByRole('heading', { name: 'GeceKodu (kopya)' });
    await waitFor(() => expect(capabilitiesApi.get).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: /Geçen seferin formundan/ })).not.toBeInTheDocument();
  });
});
