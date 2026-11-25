import { screen, waitFor, within } from '@testing-library/react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import EventsPage from '@/app/(authorized)/events/page';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { ProblemError } from '@/lib/api/core';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { identityApi } from '@/lib/api/identity';
import { ticketsApi } from '@/lib/api/tickets';
import { dashboardApi, type EventStat } from '@/lib/api/dashboard';

const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
  usePathname: () => '/events',
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

/** Starts the page at `/events?<query>`, as the address and the hooks read it. */
function at(query: string) {
  window.history.replaceState(null, '', query ? `/events?${query}` : '/events');
}
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', groups: [], roles: [] } }),
}));
jest.mock('@/components/scheduling/NewEventProvider', () => ({
  useNewEvent: () => ({ open: jest.fn(), canCreate: false }),
}));
jest.mock('@/lib/api/events', () => ({
  eventsApi: {
    list: jest.fn(),
    stats: jest.fn(),
    publish: jest.fn(),
    cancel: jest.fn(),
    uncancel: jest.fn(),
    delete: jest.fn(),
    restore: jest.fn(),
    syncMailList: jest.fn(),
  },
}));
jest.mock('@/lib/api/tickets', () => ({ ticketsApi: { listByEvent: jest.fn() } }));
jest.mock('@/lib/api/identity', () => ({ identityApi: { getUser: jest.fn() } }));
jest.mock('@/lib/api/capabilities', () => ({ capabilitiesApi: { get: jest.fn() } }));
jest.mock('@/lib/api/dashboard', () => ({ dashboardApi: { summary: jest.fn() } }));

const future = '2099-10-01T10:00:00+03:00';
const past = '2020-10-01T10:00:00+03:00';

function event(id: string, name: string, extra: Partial<CoreEvent>): CoreEvent {
  return {
    id,
    name,
    description: '',
    location: 'YTÜ',
    ownerTeam: 'GECEKODU',
    capacity: 0,
    active: false,
    ranked: false,
    createdAt: '',
    updatedAt: '',
    ...extra,
  };
}

const rows = [
  event('d', 'Taslak Kodu', { status: 'draft', startDate: future }),
  event('u', 'Yakın Kodu', { status: 'published', startDate: future, formAlias: 'yakin' }),
  event('p', 'Eski Kodu', { status: 'published', startDate: past }),
  event('c', 'İptal Kodu', { status: 'cancelled', startDate: future, cancelNotifiedAt: past }),
];

/** core's capabilities: `event.update`/`event.delete` for GECEKODU when `write`. */
function capabilities(write: boolean) {
  (capabilitiesApi.get as jest.Mock).mockResolvedValue({
    teams: [
      {
        team: 'GECEKODU',
        can: { 'event.update': write, 'event.delete': write },
      },
    ],
  });
}

function rowOf(name: string): HTMLElement {
  const row = screen.getByRole('button', { name });
  return row.closest('[data-slot="data-list-row"]') as HTMLElement;
}

/** The list is in once this Event's row is. */
const listed = (name: string) => screen.findByRole('button', { name });

async function openMenu(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name: `${name}: eylemler` }));
  return screen.findByRole('menu');
}

// jsdom has no PointerEvent; base-ui's Checkbox sends one to its hidden input on a click
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    Object.defineProperty(window, 'PointerEvent', { value: MouseEvent, configurable: true });
  }
});

describe('Etkinlikler listesi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    at('');
    window.localStorage.clear();
    (eventsApi.list as jest.Mock).mockResolvedValue(rows);
    (eventsApi.stats as jest.Mock).mockResolvedValue({ eventStats: [] });
    (ticketsApi.listByEvent as jest.Mock).mockResolvedValue([{ id: 't1' }, { id: 't2' }]);
    capabilities(true);
  });

  it('asks core for the drafts too and shows each status as a chip', async () => {
    render(<EventsPage />);
    expect(await listed('Taslak Kodu')).toBeInTheDocument();
    // Yönettiklerim by default: the Events the reader may edit
    expect(eventsApi.list).toHaveBeenCalledWith(undefined, undefined, {
      drafts: true,
      managed: true,
    });
    expect(within(rowOf('Taslak Kodu')).getAllByText('Taslak').length).toBeGreaterThan(0);
    expect(within(rowOf('Yakın Kodu')).getAllByText('Yaklaşıyor').length).toBeGreaterThan(0);
    expect(within(rowOf('Eski Kodu')).getAllByText('Bitti').length).toBeGreaterThan(0);
    expect(within(rowOf('İptal Kodu')).getAllByText('İptal').length).toBeGreaterThan(0);
    expect(screen.queryByText('Aktif')).not.toBeInTheDocument();
  });

  it('lists every Event on Bütün etkinlikler, and keeps the choice in the address', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<EventsPage />);
    await listed('Taslak Kodu');
    await user.click(screen.getByRole('button', { name: 'Bütün etkinlikler' }));
    expect(window.location.search).toContain('managed=false');
    // The page reads the address again (Next re-renders on the history change)
    unmount();
    render(<EventsPage />);
    await listed('Taslak Kodu');
    expect(eventsApi.list).toHaveBeenLastCalledWith(undefined, undefined, { drafts: true });
  });

  it('lists a team’s Events with those it co-organizes, all of them, from ?team=', async () => {
    at('team=WEBLAB');
    render(<EventsPage />);
    await listed('Taslak Kodu');
    expect(eventsApi.list).toHaveBeenCalledWith(undefined, undefined, {
      drafts: true,
      team: 'WEBLAB',
    });
    expect(screen.getByRole('button', { name: 'Ekip süzgecini kaldır: WEBLAB' })).toHaveTextContent(
      'Ekip: WEBLAB (ortak dahil)',
    );
  });

  it('chips the Co-organizer teams and marks an Event managed as a Co-organizer', async () => {
    (eventsApi.list as jest.Mock).mockResolvedValue([
      {
        ...rows[0],
        ownerTeam: 'YK',
        coOrganizerTeams: ['WEBLAB', 'ARTLAB'],
        viewer: { via: 'coTeam', can: { 'event.update': true } },
      },
    ]);
    render(<EventsPage />);
    const row = rowOf((await listed(rows[0].name)).getAttribute('aria-label') ?? rows[0].name);
    expect(within(row).getByText('Ortak')).toBeInTheDocument();
    expect(within(row).getByText(/YK \+ 2 ekip/)).toBeInTheDocument();
  });

  it('counts each slice and keeps the chosen one in the address', async () => {
    const user = userEvent.setup();
    render(<EventsPage />);
    await listed('Taslak Kodu');
    const filter = screen.getByRole('group', { name: 'Etkinlik durumu' });
    expect(within(filter).getByRole('button', { name: /Tümü/ })).toHaveTextContent('4');
    expect(within(filter).getByRole('button', { name: /Taslak/ })).toHaveTextContent('1');
    await user.click(within(filter).getByRole('button', { name: /İptal/ }));
    expect(window.location.search).toBe('?status=cancelled');
  });

  it('shows only the slice the address names', async () => {
    at('status=draft');
    render(<EventsPage />);
    expect(await listed('Taslak Kodu')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Yakın Kodu' })).not.toBeInTheDocument();
  });

  it('offers publish and delete on a draft, never on a published event', async () => {
    const user = userEvent.setup();
    render(<EventsPage />);
    await listed('Taslak Kodu');

    let menu = await openMenu(user, 'Taslak Kodu');
    expect(within(menu).getByRole('menuitem', { name: 'Yayınla' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Sil…' })).toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: 'İptal et…' })).not.toBeInTheDocument();
    // The row itself opens the event, where Düzenle lives (Kaan, #80)
    expect(within(menu).queryByRole('menuitem', { name: /Düzenle/ })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');

    menu = await openMenu(user, 'Yakın Kodu');
    expect(within(menu).getByRole('menuitem', { name: 'İptal et…' })).toBeInTheDocument();
    expect(
      within(menu).getByRole('menuitem', { name: 'Başvuru linkini kopyala' }),
    ).toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: 'Sil…' })).not.toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: 'Yayınla' })).not.toBeInTheDocument();
  });

  it('has no menu for an ended event the reader cannot act on', async () => {
    render(<EventsPage />);
    await listed('Eski Kodu');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Taslak Kodu: eylemler' })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: 'Eski Kodu: eylemler' })).not.toBeInTheDocument();
  });

  it('gives a reader without core rights (DK) only the reading items', async () => {
    capabilities(false);
    const user = userEvent.setup();
    render(<EventsPage />);
    await listed('Taslak Kodu');
    const menu = await openMenu(user, 'Yakın Kodu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Başvuru linkini kopyala']);
    expect(screen.queryByRole('button', { name: 'Taslak Kodu: eylemler' })).not.toBeInTheDocument();
  });

  it('publishes a draft without tickets without asking and shows its new status', async () => {
    (ticketsApi.listByEvent as jest.Mock).mockResolvedValue([]);
    (eventsApi.publish as jest.Mock).mockResolvedValue({ ...rows[0], status: 'published' });
    const user = userEvent.setup();
    render(<EventsPage />);
    await listed('Taslak Kodu');
    const menu = await openMenu(user, 'Taslak Kodu');
    await user.click(within(menu).getByRole('menuitem', { name: 'Yayınla' }));
    expect(eventsApi.publish).toHaveBeenCalledWith('d');
    await waitFor(() =>
      expect(within(rowOf('Taslak Kodu')).getAllByText('Yaklaşıyor').length).toBeGreaterThan(0),
    );
  });

  it('asks before publishing a draft with tickets and sends the box as asked', async () => {
    (ticketsApi.listByEvent as jest.Mock).mockResolvedValue([
      {
        id: 't1',
        ticketType: 'REGISTERED',
        ownerId: 'p1',
        owner: { id: 'p1', email: 'ali@example.com', firstName: 'Ali', lastName: 'Kaya' },
      },
      { id: 't2', ticketType: 'REGISTERED', ownerId: 'p2' },
      { id: 't3', ticketType: 'REGISTERED', ownerId: 'p3' },
    ]);
    // The list's Tickets may come without their owner: the dialog reads them by id
    (identityApi.getUser as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'p2') return { id, email: 'ece@example.com', firstName: 'Ece', lastName: 'Su' };
      throw new Error('gone');
    });
    (eventsApi.publish as jest.Mock).mockResolvedValue({ ...rows[0], status: 'published' });
    const user = userEvent.setup();
    render(<EventsPage />);
    await listed('Taslak Kodu');
    const menu = await openMenu(user, 'Taslak Kodu');
    await user.click(within(menu).getByRole('menuitem', { name: 'Yayınla' }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Etkinliği yayınla' });
    // A holder whose read failed is counted, not named
    expect(identityApi.getUser).toHaveBeenCalledWith('p2');
    expect(identityApi.getUser).not.toHaveBeenCalledWith('p1');
    const box = within(dialog).getByRole('checkbox', {
      name: 'Taslakta eklenen 3 kişiye bilet e-postası gönder',
    });
    expect(box).toBeChecked();
    expect(box).toHaveAccessibleDescription('Ali Kaya, Ece Su ve 1 kişi daha');
    await user.click(box);
    await user.click(within(dialog).getByRole('button', { name: 'Yayınla' }));
    expect(eventsApi.publish).toHaveBeenCalledWith('d', { notifyTicketHolders: false });
    await waitFor(() =>
      expect(within(rowOf('Taslak Kodu')).getAllByText('Yaklaşıyor').length).toBeGreaterThan(0),
    );
  });

  it('asks with the box but no count when the tickets cannot be read', async () => {
    (ticketsApi.listByEvent as jest.Mock).mockRejectedValue(new Error('down'));
    (eventsApi.publish as jest.Mock).mockResolvedValue({ ...rows[0], status: 'published' });
    const user = userEvent.setup();
    render(<EventsPage />);
    await listed('Taslak Kodu');
    const menu = await openMenu(user, 'Taslak Kodu');
    await user.click(within(menu).getByRole('menuitem', { name: 'Yayınla' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Etkinliği yayınla' });
    expect(
      within(dialog).getByRole('checkbox', {
        name: 'Taslakta eklenen kişilere bilet e-postası gönder',
      }),
    ).toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Yayınla' }));
    expect(eventsApi.publish).toHaveBeenCalledWith('d', { notifyTicketHolders: true });
  });

  it('says why core refused a publish', async () => {
    (ticketsApi.listByEvent as jest.Mock).mockResolvedValue([]);
    (eventsApi.publish as jest.Mock).mockRejectedValue(
      new ProblemError(400, 'Bad Request', {
        code: 'event_incomplete',
        fields: { missing: ['startDate'] },
      }),
    );
    const user = userEvent.setup();
    render(<EventsPage />);
    await listed('Taslak Kodu');
    const menu = await openMenu(user, 'Taslak Kodu');
    await user.click(within(menu).getByRole('menuitem', { name: 'Yayınla' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Yayınlamak için eksik: başlangıç tarihi.',
    );
  });

  it('cancels with the reason and the notify box, ticked by default', async () => {
    (eventsApi.cancel as jest.Mock).mockResolvedValue({ ...rows[1], status: 'cancelled' });
    const user = userEvent.setup();
    render(<EventsPage />);
    await listed('Yakın Kodu');
    const menu = await openMenu(user, 'Yakın Kodu');
    await user.click(within(menu).getByRole('menuitem', { name: 'İptal et…' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Etkinliği iptal et')).toBeInTheDocument();
    expect(within(dialog).getByText('2 kayıt var.')).toBeInTheDocument();
    const box = within(dialog).getByRole('checkbox', { name: 'Bilet sahiplerine bildir (2 kişi)' });
    expect(box).toBeChecked();
    await user.type(
      within(dialog).getByRole('textbox', { name: 'İptal açıklaması (herkese görünür)' }),
      'Hava koşulları',
    );
    await user.click(within(dialog).getByRole('button', { name: 'İptal et' }));

    expect(eventsApi.cancel).toHaveBeenCalledWith('u', {
      reason: 'Hava koşulları',
      notifyTicketHolders: true,
    });
    await waitFor(() =>
      expect(within(rowOf('Yakın Kodu')).getAllByText('İptal').length).toBeGreaterThan(0),
    );
  });

  it('cancels without mailing when the box is cleared and offers the mail by hand', async () => {
    (eventsApi.cancel as jest.Mock).mockResolvedValue({ ...rows[1], status: 'cancelled' });
    const user = userEvent.setup();
    render(<EventsPage />);
    await listed('Yakın Kodu');
    const menu = await openMenu(user, 'Yakın Kodu');
    await user.click(within(menu).getByRole('menuitem', { name: 'İptal et…' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('checkbox'));
    await user.click(within(dialog).getByRole('button', { name: 'İptal et' }));
    expect(eventsApi.cancel).toHaveBeenCalledWith('u', { notifyTicketHolders: false });
    expect(
      await screen.findByRole('button', { name: 'Katılımcılara haber ver' }),
    ).toBeInTheDocument();
  });

  it('undoes a mailed cancellation with "tekrar bildir" ticked by default', async () => {
    (eventsApi.uncancel as jest.Mock).mockResolvedValue({ ...rows[3], status: 'published' });
    const user = userEvent.setup();
    render(<EventsPage />);
    await listed('İptal Kodu');
    const menu = await openMenu(user, 'İptal Kodu');
    await user.click(within(menu).getByRole('menuitem', { name: 'İptali geri al…' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByRole('checkbox', { name: 'Katılımcılara tekrar bildir' }),
    ).toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Geri al' }));
    expect(eventsApi.uncancel).toHaveBeenCalledWith('c', { notifyTicketHolders: true });
  });

  it('deletes a draft after asking and takes it off the list', async () => {
    (eventsApi.delete as jest.Mock).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<EventsPage />);
    await listed('Taslak Kodu');
    const menu = await openMenu(user, 'Taslak Kodu');
    await user.click(within(menu).getByRole('menuitem', { name: 'Sil…' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Etkinliği sil' }));
    expect(eventsApi.delete).toHaveBeenCalledWith('d');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Taslak Kodu' })).not.toBeInTheDocument(),
    );
  });

  it('shows each row with its registrations, entries and what a draft lacks', async () => {
    (eventsApi.list as jest.Mock).mockResolvedValue([
      { ...rows[1], capacity: 120 },
      { ...rows[0], location: '', formUrl: undefined },
    ]);
    (eventsApi.stats as jest.Mock).mockResolvedValue({ eventStats: [stat('u', 42, 21)] });
    render(<EventsPage />);
    await listed('Yakın Kodu');
    const row = rowOf('Yakın Kodu');
    expect(await within(row).findByText('42')).toBeInTheDocument();
    expect(within(row).getByText('/ 120')).toBeInTheDocument();
    expect(within(row).getByText('· %50')).toBeInTheDocument();
    // The draft has no cover, place nor form: the first two are named
    expect(within(rowOf('Taslak Kodu')).getByText('Yer, kapak +1 eksik')).toBeInTheDocument();
  });

  it("falls back on the dashboard's figures when core has no list figures yet", async () => {
    (eventsApi.stats as jest.Mock).mockRejectedValue(new ProblemError(404, 'Not Found'));
    (dashboardApi.summary as jest.Mock).mockResolvedValue({ eventStats: [stat('u', 7, 3)] });
    render(<EventsPage />);
    await listed('Yakın Kodu');
    expect(await within(rowOf('Yakın Kodu')).findByText('7')).toBeInTheDocument();
  });

  it('turns the list to a slice from its summary card and back', async () => {
    const user = userEvent.setup();
    render(<EventsPage />);
    await listed('Taslak Kodu');
    const cards = screen.getByRole('group', { name: 'Özet' });
    await user.click(within(cards).getByRole('button', { name: /Taslak/ }));
    expect(window.location.search).toBe('?status=draft');
  });

  it('opens a row beside the list and leads to its page', async () => {
    const user = userEvent.setup();
    render(<EventsPage />);
    await user.click(await listed('Yakın Kodu'));
    expect(window.location.search).toBe('?panel=u');
  });

  it('shows the row the address names beside the list, with its full page', async () => {
    at('panel=u');
    (eventsApi.stats as jest.Mock).mockResolvedValue({ eventStats: [stat('u', 42, 21)] });
    render(<EventsPage />);
    const panel = await screen.findByRole('dialog', { name: 'Yakın Kodu' });
    expect(within(panel).getByRole('link', { name: /Tam sayfa/ })).toHaveAttribute(
      'href',
      '/events/u',
    );
    expect(await within(panel).findByText('Son 14 gün: 6 kayıt')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Katılımcılar' })).toHaveAttribute(
      'href',
      '/events/u/participants',
    );
  });

  it('draws the calendar from the address and opens an event from its bar', async () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 10, 10).toISOString();
    const end = new Date(today.getFullYear(), today.getMonth(), 12, 18).toISOString();
    (eventsApi.list as jest.Mock).mockResolvedValue([
      event('m', 'Üç Günlük Kamp', { status: 'published', startDate: start, endDate: end }),
      event('n', 'Tarihsiz Buluşma', { status: 'published' }),
    ]);
    at('view=calendar');
    const user = userEvent.setup();
    render(<EventsPage />);
    const month = await waitFor(() => {
      const el = document.querySelector('[data-slot="event-calendar-month"]');
      if (!el) throw new Error('no month yet');
      return el as HTMLElement;
    });
    // One bar for the three days
    expect(within(month).getAllByRole('button', { name: 'Üç Günlük Kamp' })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Tarihsiz' })).toBeInTheDocument();
    await user.click(within(month).getByRole('button', { name: 'Üç Günlük Kamp' }));
    expect(window.location.search).toBe('?view=calendar&panel=m');
  });
});

function stat(id: string, applications: number, checkedIn: number): EventStat {
  return {
    id,
    name: id,
    ownerTeam: 'GECEKODU',
    location: 'YTÜ',
    active: true,
    live: false,
    capacity: 120,
    hasApplicationForm: true,
    hasCoverImage: false,
    applications,
    members: applications - 2,
    guests: 2,
    checkedIn,
    dailyApplications: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 2, 0, 3, 0],
  };
}
