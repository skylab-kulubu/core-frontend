import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { act, Suspense } from 'react';
import EventDetailPage from '@/app/(authorized)/events/[id]/page';
import { competitorsApi } from '@/lib/api/competitors';
import { eventDaysApi } from '@/lib/api/eventDays';
import { eventsApi } from '@/lib/api/events';
import { identityApi } from '@/lib/api/identity';
import { teamsApi } from '@/lib/api/teams';
import { ticketsApi } from '@/lib/api/tickets';
import { sessionsApi } from '@/lib/api/sessions';
import { useAuth } from '@/context/AuthContext';
import type { UserDto } from '@/types/api';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/api/events', () => ({
  eventsApi: {
    get: jest.fn(),
    delete: jest.fn(),
    list: jest.fn(),
    syncMailList: jest.fn(),
  },
}));

jest.mock('@/lib/api/eventDays', () => ({
  eventDaysApi: {
    listByEvent: jest.fn(),
    listSessions: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('@/lib/api/sessions', () => {
  const actual = jest.requireActual('@/lib/api/sessions');
  return {
    ...actual,
    sessionsApi: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  };
});

jest.mock('@/lib/api/tickets', () => ({
  ticketsApi: {
    listByEvent: jest.fn(),
    listDoorEvents: jest.fn(),
    searchDoorAttendees: jest.fn(),
    resolveAndCheckIn: jest.fn(),
    checkIn: jest.fn(),
    applyMe: jest.fn(),
  },
}));

jest.mock('@/lib/api/identity', () => ({
  identityApi: { listUsers: jest.fn(), getUser: jest.fn() },
}));

jest.mock('@/lib/api/competitors', () => ({
  competitorsApi: { listByEvent: jest.fn() },
}));

jest.mock('@/lib/api/teams', () => ({
  teamsApi: { list: jest.fn() },
}));

jest.mock('@/lib/api/seasons', () => ({
  seasonsApi: { list: jest.fn() },
}));

const event = {
  id: 'e1',
  name: 'GeceKodu',
  description: '',
  location: 'YTÜ',
  ownerTeam: 'GECEKODU',
  capacity: 10,
  active: true,
  ranked: false,
  createdAt: '',
  updatedAt: '',
};

const session = {
  id: 's1',
  eventDayId: 'd1',
  title: 'Açılış',
  speakerName: 'Ada',
  orderIndex: 0,
  sessionType: 'KEYNOTE',
};

const guestTicket = {
  id: 't-guest',
  eventId: 'e1',
  ticketType: 'GUEST' as const,
  guestFirstName: 'Ada',
  guestLastName: 'Lovelace',
  guestEmail: 'ada@example.com',
  checkIns: [],
  createdAt: '2026-09-19T08:05:00.000Z',
  updatedAt: '2026-09-19T08:05:00.000Z',
};

function authUser(groups: string[]): UserDto {
  return {
    id: 'u1',
    username: 'op',
    email: 'op@example.com',
    firstName: 'O',
    lastName: 'P',
    roles: [],
    groups,
  };
}

async function renderHub() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <EventDetailPage params={Promise.resolve({ id: 'e1' })} />
      </Suspense>,
    );
  });
}

describe('Event hub Katıldı', () => {
  beforeEach(() => {
    (eventsApi.get as jest.Mock).mockResolvedValue(event);
    (eventDaysApi.listByEvent as jest.Mock).mockResolvedValue([
      { id: 'd1', eventId: 'e1', name: 'Gün 1' },
    ]);
    (eventDaysApi.listSessions as jest.Mock).mockResolvedValue([session]);
    (ticketsApi.listByEvent as jest.Mock).mockResolvedValue([]);
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([]);
    (ticketsApi.searchDoorAttendees as jest.Mock).mockResolvedValue([]);
    (identityApi.listUsers as jest.Mock).mockResolvedValue([]);
    (competitorsApi.listByEvent as jest.Mock).mockResolvedValue([]);
    (teamsApi.list as jest.Mock).mockResolvedValue([]);
    (eventsApi.list as jest.Mock).mockResolvedValue([]);
  });

  it('hides Katıldı for a GECEKODU member who can still write the event', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: authUser(['/UYELER/ORGANIZASYON/GECEKODU']),
    });
    await renderHub();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'GeceKodu' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Düzenle' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Katıldı' })).not.toBeInTheDocument();
  });

  it('shows Katıldı for the owner-team Leader', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: authUser(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']),
    });
    await renderHub();
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Katıldı' }).length).toBeGreaterThan(0),
    );
  });

  it('shows Katıldı for assigned door staff without exposing the roster', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: authUser(['/UYELER/ARGE/WEBLAB']) });
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([
      { id: 'e1', name: 'GeceKodu', ownerTeam: 'GECEKODU' },
    ]);

    await renderHub();

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Katıldı' }).length).toBeGreaterThan(0),
    );
    expect(screen.queryByRole('heading', { name: 'Başvuranlar' })).not.toBeInTheDocument();
  });

  it('accepts a typed name in the Katıldı person field', async () => {
    const user = userEvent.setup();
    (useAuth as jest.Mock).mockReturnValue({
      user: authUser(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']),
    });
    (ticketsApi.listByEvent as jest.Mock).mockResolvedValue([guestTicket]);
    (ticketsApi.resolveAndCheckIn as jest.Mock).mockResolvedValue({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      sessionId: 's1',
      eventDayId: 'd1',
      personName: 'Ada Lovelace',
      createdAt: new Date(2026, 8, 19, 9, 4, 0).toISOString(),
    });
    await renderHub();
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Katıldı' }).length).toBeGreaterThan(0),
    );
    const deskButtons = screen.getAllByRole('button', { name: 'Katıldı' });
    await user.click(deskButtons[deskButtons.length - 1]);
    const dialog = await screen.findByRole('dialog', { name: 'Açılış · Katıldı' });
    expect(within(dialog).getByRole('button', { name: 'Katılımcı bul' })).toBeInTheDocument();
    const field = within(dialog).getByLabelText('Ad veya e-posta') as HTMLInputElement;
    expect(field).toHaveAttribute('type', 'text');
    expect(field).toHaveAttribute('placeholder', 'Ad veya e-posta');
    await user.type(field, 'Ada Lovelace');
    expect(field.checkValidity()).toBe(true);
    await user.click(within(dialog).getByRole('button', { name: 'Katıldı' }));
    await waitFor(() =>
      expect(ticketsApi.resolveAndCheckIn).toHaveBeenCalledWith('s1', {
        personId: undefined,
        query: 'Ada Lovelace',
      }),
    );
    expect(await screen.findByRole('status', { name: 'Check-in sonucu' })).toHaveTextContent(
      /Ada Lovelace · Açılış · /,
    );
  });

  it('opens Skymail with only the selected applicants', async () => {
    const user = userEvent.setup();
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    (useAuth as jest.Mock).mockReturnValue({
      user: authUser(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']),
    });
    (ticketsApi.listByEvent as jest.Mock).mockResolvedValue([guestTicket]);
    (eventsApi.syncMailList as jest.Mock).mockResolvedValue({
      mailListId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      recipientCount: 1,
    });

    await renderHub();
    await user.click(await screen.findByRole('checkbox', { name: 'Ada Lovelace seç' }));
    await user.click(screen.getByRole('button', { name: 'Seçilenlere mail' }));

    await waitFor(() => expect(eventsApi.syncMailList).toHaveBeenCalledWith('e1', ['t-guest']));
    expect(open).toHaveBeenCalledWith(
      'https://mail.yildizskylab.com/mail-tasks/create?mail_list_id=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '_blank',
      'noopener,noreferrer',
    );
    open.mockRestore();
  });
});

describe('Event hub apply-for-other', () => {
  beforeEach(() => {
    (eventsApi.get as jest.Mock).mockResolvedValue(event);
    (eventDaysApi.listByEvent as jest.Mock).mockResolvedValue([
      { id: 'd1', eventId: 'e1', name: 'Gün 1' },
    ]);
    (eventDaysApi.listSessions as jest.Mock).mockResolvedValue([session]);
    (ticketsApi.listByEvent as jest.Mock).mockResolvedValue([]);
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([]);
    (ticketsApi.searchDoorAttendees as jest.Mock).mockResolvedValue([]);
    (identityApi.listUsers as jest.Mock).mockResolvedValue([]);
    (competitorsApi.listByEvent as jest.Mock).mockResolvedValue([]);
    (teamsApi.list as jest.Mock).mockResolvedValue([]);
    (eventsApi.list as jest.Mock).mockResolvedValue([]);
  });

  it('rejects a whitespace-only day name before calling the API', async () => {
    const user = userEvent.setup();
    (useAuth as jest.Mock).mockReturnValue({
      user: authUser(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']),
    });
    await renderHub();
    await user.click(await screen.findByRole('button', { name: 'Gün ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Gün ekle' });
    await user.type(within(dialog).getByLabelText('Gün adı'), '   ');
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    expect(eventDaysApi.create).not.toHaveBeenCalled();
    expect(within(dialog).getByText('Gün adı zorunlu')).toBeInTheDocument();
  });

  it('rejects a whitespace-only session title before calling the API', async () => {
    const user = userEvent.setup();
    (useAuth as jest.Mock).mockReturnValue({
      user: authUser(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']),
    });
    await renderHub();
    await user.click(await screen.findByRole('button', { name: 'Oturum ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Oturum ekle' });
    await user.type(within(dialog).getByLabelText('Başlık'), '   ');
    await user.type(within(dialog).getByLabelText('Konuşmacı'), 'Ada');
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    expect(sessionsApi.create).not.toHaveBeenCalled();
    expect(within(dialog).getByText('Başlık zorunlu')).toBeInTheDocument();
  });

  it('lets a GECEKODU member see the roster but not apply-for-other', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: authUser(['/UYELER/ORGANIZASYON/GECEKODU']),
    });
    await renderHub();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Başvuranlar' })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: 'Katılımcı ekle' })).not.toBeInTheDocument();
  });

  it('opens the editor when GET omits images, extra forms, and door staff', async () => {
    const user = userEvent.setup();
    (useAuth as jest.Mock).mockReturnValue({
      user: authUser(['/UYELER/YK']),
    });
    await renderHub();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'GeceKodu' })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Düzenle' }));
    expect(await screen.findByRole('dialog', { name: 'Etkinliği düzenle' })).toBeInTheDocument();
  });

  it.each([
    {
      name: 'Privileged',
      groups: ['/UYELER/YK'],
    },
    {
      name: 'owner-team Leader',
      groups: ['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER'],
    },
  ])('shows Katılımcı ekle for $name', async ({ groups }) => {
    (useAuth as jest.Mock).mockReturnValue({
      user: authUser(groups),
    });
    await renderHub();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Katılımcı ekle' })).toBeInTheDocument(),
    );
  });
});
