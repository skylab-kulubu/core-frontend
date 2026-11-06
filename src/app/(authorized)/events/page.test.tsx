import { screen, waitFor, within } from '@testing-library/react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import EventsPage from '@/app/(authorized)/events/page';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { ProblemError } from '@/lib/api/core';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { ticketsApi } from '@/lib/api/tickets';

const mockReplace = jest.fn();
let mockSearch = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
  useSearchParams: () => mockSearch,
}));
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', groups: [], roles: [] } }),
}));
jest.mock('@/components/scheduling/NewEventProvider', () => ({
  useNewEvent: () => ({ open: jest.fn(), canCreate: false }),
}));
jest.mock('@/lib/api/events', () => ({
  eventsApi: {
    list: jest.fn(),
    publish: jest.fn(),
    cancel: jest.fn(),
    uncancel: jest.fn(),
    delete: jest.fn(),
    restore: jest.fn(),
    syncMailList: jest.fn(),
  },
}));
jest.mock('@/lib/api/tickets', () => ({ ticketsApi: { listByEvent: jest.fn() } }));
jest.mock('@/lib/api/capabilities', () => ({ capabilitiesApi: { get: jest.fn() } }));

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
  const link = screen.getByRole('link', { name });
  return link.closest('[data-slot="list-item"]') as HTMLElement;
}

/** The list is in once this Event's row link is. */
const listed = (name: string) => screen.findByRole('link', { name });

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
    mockSearch = new URLSearchParams();
    (eventsApi.list as jest.Mock).mockResolvedValue(rows);
    (ticketsApi.listByEvent as jest.Mock).mockResolvedValue([{ id: 't1' }, { id: 't2' }]);
    capabilities(true);
  });

  it('asks core for the drafts too and shows each status as a chip', async () => {
    render(<EventsPage />);
    expect(await listed('Taslak Kodu')).toBeInTheDocument();
    expect(eventsApi.list).toHaveBeenCalledWith(undefined, undefined, { drafts: true });
    expect(within(rowOf('Taslak Kodu')).getAllByText('Taslak').length).toBeGreaterThan(0);
    expect(within(rowOf('Yakın Kodu')).getAllByText('Yaklaşıyor').length).toBeGreaterThan(0);
    expect(within(rowOf('Eski Kodu')).getAllByText('Bitti').length).toBeGreaterThan(0);
    expect(within(rowOf('İptal Kodu')).getAllByText('İptal').length).toBeGreaterThan(0);
    expect(screen.queryByText('Aktif')).not.toBeInTheDocument();
  });

  it('counts each slice and keeps the chosen one in the address', async () => {
    const user = userEvent.setup();
    render(<EventsPage />);
    await listed('Taslak Kodu');
    const filter = screen.getByRole('group', { name: 'Etkinlik durumu' });
    expect(within(filter).getByRole('button', { name: /Tümü/ })).toHaveTextContent('4');
    expect(within(filter).getByRole('button', { name: /Taslak/ })).toHaveTextContent('1');
    await user.click(within(filter).getByRole('button', { name: /İptal/ }));
    expect(mockReplace).toHaveBeenCalledWith('/events?status=cancelled');
  });

  it('shows only the slice the address names', async () => {
    mockSearch = new URLSearchParams('status=draft');
    render(<EventsPage />);
    expect(await listed('Taslak Kodu')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Yakın Kodu' })).not.toBeInTheDocument();
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

  it('publishes a draft without asking and shows its new status', async () => {
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

  it('says why core refused a publish', async () => {
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
      expect(screen.queryByRole('link', { name: 'Taslak Kodu' })).not.toBeInTheDocument(),
    );
  });
});
