import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import EventOverviewPage from '@/app/(authorized)/events/[id]/(workspace)/page';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { ProblemError } from '@/lib/api/core';
import { eventsApi } from '@/lib/api/events';
import { ticketsApi } from '@/lib/api/tickets';
import {
  guestTicket,
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
jest.mock('@/lib/api/capabilities', () => ({ capabilitiesApi: { get: jest.fn() } }));
jest.mock('@/lib/scheduling/save-event', () =>
  jest.requireActual('@/test/event-workspace').saveEventModule(),
);

// jsdom has no PointerEvent; base-ui's Checkbox sends one to its hidden input on a click
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    Object.defineProperty(window, 'PointerEvent', { value: MouseEvent, configurable: true });
  }
});

const LEADER = ['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER'];
const future = '2099-10-01T10:00:00+03:00';

/** core's capabilities for GECEKODU: the Event writes when `write`, none for a DK reader. */
function capabilities(write: boolean) {
  (capabilitiesApi.get as jest.Mock).mockResolvedValue({
    teams: [{ team: 'GECEKODU', can: { 'event.update': write, 'event.delete': write } }],
  });
}

function opens(event: Record<string, unknown>) {
  (eventsApi.get as jest.Mock).mockResolvedValue({ ...workspaceEvent, ...event });
}

async function header() {
  await screen.findByRole('heading', { name: 'GeceKodu' });
  return screen.getByRole('banner');
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Diğer eylemler' }));
  return screen.findByRole('menu');
}

describe('Etkinlik sayfası: durum ve eylemler', () => {
  beforeEach(() => {
    primeEventWorkspace();
    signInAs(LEADER);
    capabilities(true);
  });

  it('shows a draft as Taslak with Yayınla first, and publishes it without asking', async () => {
    const user = userEvent.setup();
    opens({ status: 'draft', active: false, startDate: future });
    (eventsApi.publish as jest.Mock).mockResolvedValue({
      ...workspaceEvent,
      status: 'published',
      active: true,
      startDate: future,
    });
    await renderEventTab(<EventOverviewPage />);
    const top = await header();
    expect(within(top).getByText('Taslak')).toBeInTheDocument();
    expect(within(top).queryByText('Aktif')).not.toBeInTheDocument();

    await user.click(await within(top).findByRole('button', { name: 'Yayınla' }));
    expect(eventsApi.publish).toHaveBeenCalledWith('e1');
    expect(await within(top).findByText('Yaklaşıyor')).toBeInTheDocument();
    expect(within(top).queryByRole('button', { name: 'Yayınla' })).not.toBeInTheDocument();
  });

  it('says what a publish is missing', async () => {
    const user = userEvent.setup();
    opens({ status: 'draft', active: false });
    (eventsApi.publish as jest.Mock).mockRejectedValue(
      new ProblemError(400, 'Bad Request', {
        code: 'event_incomplete',
        fields: { missing: ['startDate'] },
      }),
    );
    await renderEventTab(<EventOverviewPage />);
    await user.click(await screen.findByRole('button', { name: 'Yayınla' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Yayınlamak için eksik: başlangıç tarihi.',
    );
  });

  it('lets a draft be deleted, never a published event', async () => {
    const user = userEvent.setup();
    opens({ status: 'draft', active: false });
    await renderEventTab(<EventOverviewPage />);
    const menu = await openMenu(user);
    expect(within(menu).getByRole('menuitem', { name: 'Sil…' })).toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: 'İptal et…' })).not.toBeInTheDocument();
  });

  it('shows a DK reader the draft with no action at all', async () => {
    capabilities(false);
    signInAs(['/UYELER/DK']);
    opens({ status: 'draft', active: false });
    await renderEventTab(<EventOverviewPage />);
    const top = await header();
    expect(within(top).getByText('Taslak')).toBeInTheDocument();
    await waitFor(() => expect(capabilitiesApi.get).toHaveBeenCalled());
    expect(within(top).queryByRole('button', { name: 'Yayınla' })).not.toBeInTheDocument();
    expect(within(top).queryByRole('button', { name: 'Diğer eylemler' })).not.toBeInTheDocument();
    expect(within(top).queryByRole('button', { name: 'Düzenle' })).not.toBeInTheDocument();
  });

  it('offers unpublish only without registrations, and says how many there are', async () => {
    const user = userEvent.setup();
    opens({ status: 'published', active: true, startDate: future });
    (ticketsApi.listByEvent as jest.Mock).mockResolvedValue([
      guestTicket,
      { ...guestTicket, id: 't2' },
    ]);
    await renderEventTab(<EventOverviewPage />);
    await screen.findByText('2 başvuru');
    const menu = await openMenu(user);
    const unpublish = within(menu).getByRole('menuitem', { name: /Taslağa al/ });
    expect(unpublish).toHaveAttribute('aria-disabled', 'true');
    expect(unpublish).toHaveTextContent('2 kayıt var');
    expect(within(menu).queryByRole('menuitem', { name: 'Sil…' })).not.toBeInTheDocument();
  });

  it('cancels with the notify box ticked for the ticket holders', async () => {
    const user = userEvent.setup();
    opens({ status: 'published', active: true, startDate: future });
    (ticketsApi.listByEvent as jest.Mock).mockResolvedValue([
      guestTicket,
      { ...guestTicket, id: 't2' },
    ]);
    (eventsApi.cancel as jest.Mock).mockResolvedValue({
      ...workspaceEvent,
      status: 'cancelled',
      active: false,
      startDate: future,
      cancelledAt: '2026-10-20T09:00:00Z',
      cancelReason: 'Hava koşulları',
      cancelNotifiedAt: '2026-10-20T09:00:00Z',
    });
    await renderEventTab(<EventOverviewPage />);
    await screen.findByText('2 başvuru');
    const menu = await openMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: 'İptal et…' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Etkinliği iptal et' });
    expect(within(dialog).getByText('2 kayıt var.')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('checkbox', { name: 'Bilet sahiplerine bildir (2 kişi)' }),
    ).toBeChecked();
    await user.type(within(dialog).getByRole('textbox'), 'Hava koşulları');
    await user.click(within(dialog).getByRole('button', { name: 'İptal et' }));
    expect(eventsApi.cancel).toHaveBeenCalledWith('e1', {
      reason: 'Hava koşulları',
      notifyTicketHolders: true,
    });

    // The band: when, why, and the undo
    const band = await screen.findByText('20 Ekim 2026 tarihinde iptal edildi.');
    expect(screen.getByText('Hava koşulları')).toBeInTheDocument();
    expect(band).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'İptali geri al' })).toBeInTheDocument();
  });

  it('hides the door and adding people on a cancelled event, and links the form to close', async () => {
    opens({
      status: 'cancelled',
      active: false,
      startDate: future,
      cancelledAt: '2026-10-20T09:00:00Z',
      formUrl: 'https://forms.yildizskylab.com/11111111-1111-4111-8111-111111111111',
    });
    await renderEventTab(<EventOverviewPage />);
    await screen.findByText('20 Ekim 2026 tarihinde iptal edildi.');
    expect(screen.queryByRole('link', { name: 'Kapı' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: "SkyForms'ta formu kapat" })).toHaveAttribute(
      'href',
      expect.stringContaining('/forms/11111111-1111-4111-8111-111111111111/edit'),
    );
  });

  it('undoes a cancellation, asking to mail again only when the cancellation was mailed', async () => {
    const user = userEvent.setup();
    opens({ status: 'cancelled', active: false, startDate: future, cancelledAt: future });
    (eventsApi.uncancel as jest.Mock).mockResolvedValue({
      ...workspaceEvent,
      status: 'published',
      active: true,
      startDate: future,
    });
    await renderEventTab(<EventOverviewPage />);
    await user.click(await screen.findByRole('button', { name: 'İptali geri al' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'İptali geri al' });
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Geri al' }));
    expect(eventsApi.uncancel).toHaveBeenCalledWith('e1', { notifyTicketHolders: false });
    await waitFor(() =>
      expect(screen.queryByText(/tarihinde iptal edildi/)).not.toBeInTheDocument(),
    );
  });

  it('closes and opens applying, and shows a closed one', async () => {
    const user = userEvent.setup();
    opens({ status: 'published', active: true, registrationOpen: true, startDate: future });
    (eventsApi.patch as jest.Mock).mockResolvedValue({
      ...workspaceEvent,
      status: 'published',
      active: true,
      startDate: future,
      registrationClosed: true,
      registrationOpen: false,
    });
    await renderEventTab(<EventOverviewPage />);
    const menu = await openMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: 'Başvuruyu kapat' }));
    expect(eventsApi.patch).toHaveBeenCalledWith('e1', { registrationClosed: true });
    expect(
      await within(screen.getByRole('banner')).findByText('Başvuru kapalı'),
    ).toBeInTheDocument();
    const again = await openMenu(user);
    expect(within(again).getByRole('menuitem', { name: 'Başvuruyu aç' })).toBeInTheDocument();
  });
});
