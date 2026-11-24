import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ProblemError } from '@/lib/api/core';
import { DoorDesk, EVENT_DOOR } from '@/components/scheduling/DoorDesk';
import { eventDaysApi } from '@/lib/api/eventDays';
import { ticketsApi } from '@/lib/api/tickets';
import { scanRefusal } from '@/lib/door-check-in';

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'op', groups: ['/UYELER/YK'], roles: [] } }),
}));

jest.mock('@/lib/api/events', () => ({ eventsApi: { list: jest.fn() } }));

jest.mock('@/lib/api/eventDays', () => ({
  eventDaysApi: { listByEvent: jest.fn(), listSessions: jest.fn() },
}));

jest.mock('@/lib/api/tickets', () => ({
  ticketsApi: {
    listDoorEvents: jest.fn(),
    searchDoorAttendees: jest.fn(),
    resolveAndCheckIn: jest.fn(),
    scanCheckIn: jest.fn(),
    undoCheckIn: jest.fn(),
    doorActivity: jest.fn(),
    createDoorQr: jest.fn(),
    scanEntry: jest.fn(),
    resolveEntry: jest.fn(),
    undoEntry: jest.fn(),
    venueEntries: jest.fn(),
  },
}));

const door = {
  id: 'e1',
  name: 'Buluşma',
  location: 'YTÜ',
  ownerTeam: 'WEBLAB',
  active: true,
  ranked: false,
  effectiveEntryMode: 'venue',
};

const entry = (id: string, name: string) => ({
  id,
  kind: 'entry',
  entryDate: '2026-11-25',
  source: 'desk',
  name,
  createdAt: new Date(2026, 10, 25, 19, 4, 0).toISOString(),
});

describe('DoorDesk at the event’s own door', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([door]);
    (eventDaysApi.listByEvent as jest.Mock).mockResolvedValue([]);
    (eventDaysApi.listSessions as jest.Mock).mockResolvedValue([]);
    (ticketsApi.searchDoorAttendees as jest.Mock).mockResolvedValue([]);
    (ticketsApi.venueEntries as jest.Mock).mockResolvedValue([entry('v0', 'Grace Hopper')]);
    (ticketsApi.resolveEntry as jest.Mock).mockResolvedValue(entry('v1', 'Ada Lovelace'));
    (ticketsApi.undoEntry as jest.Mock).mockResolvedValue(undefined);
  });

  const picker = () => screen.getByLabelText('Oturum');
  const box = () => screen.getByLabelText('Kişi ya da bilet');

  it('opens on the event’s door when the event has no session, with no guest QR', async () => {
    render(<DoorDesk eventId="e1" />);
    await waitFor(() => expect(picker()).toHaveValue(EVENT_DOOR));
    expect(screen.queryByRole('option', { name: 'Oturum seç' })).not.toBeInTheDocument();
    expect(
      screen.getByText('Bu etkinliğin oturumu yok: kapı etkinlik girişini yazar.'),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: /Misafir QR/ })).not.toBeInTheDocument();
    // Today's entries and their count
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeVisible());
    expect(screen.getByRole('status', { name: 'Giren sayısı' })).toHaveTextContent(
      'Etkinlik girişi · bugün1',
    );
    expect(ticketsApi.venueEntries).toHaveBeenCalledWith('e1');
    expect(ticketsApi.doorActivity).not.toHaveBeenCalled();
  });

  it('writes the day’s entry from the box at the event’s door', async () => {
    const user = userEvent.setup();
    render(<DoorDesk eventId="e1" />);
    await waitFor(() => expect(picker()).toHaveValue(EVENT_DOOR));
    await user.type(box(), 'ABCD-1234{Enter}');
    await waitFor(() =>
      expect(ticketsApi.resolveEntry).toHaveBeenCalledWith('e1', { query: 'ABCD-1234' }),
    );
    const result = screen.getByRole('status', { name: 'Giriş sonucu' });
    await waitFor(() => expect(result).toHaveTextContent('Ada Lovelace'));
    expect(ticketsApi.resolveAndCheckIn).not.toHaveBeenCalled();
  });

  it('says who is already in today on a second entry', async () => {
    const user = userEvent.setup();
    (ticketsApi.resolveEntry as jest.Mock).mockRejectedValue(
      new ProblemError(409, 'Conflict', {
        code: 'already_entered',
        fields: { name: 'Ada Lovelace' },
      }),
    );
    render(<DoorDesk eventId="e1" />);
    await waitFor(() => expect(picker()).toHaveValue(EVENT_DOOR));
    await user.type(box(), 'ada{Enter}');
    const result = screen.getByRole('status', { name: 'Giriş sonucu' });
    await waitFor(() => expect(result).toHaveTextContent('Bugün zaten girmiş'));
    expect(result).toHaveTextContent('Ada Lovelace bugün etkinliğe girdi.');
    expect(result.firstElementChild).toHaveClass('bg-warning/15');
  });

  it('offers the event’s door beside the sessions of an event that has some', async () => {
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([
      { ...door, effectiveEntryMode: 'per_session' },
    ]);
    (eventDaysApi.listByEvent as jest.Mock).mockResolvedValue([
      { id: 'd1', eventId: 'e1', name: 'Gün' },
    ]);
    (eventDaysApi.listSessions as jest.Mock).mockResolvedValue([
      {
        id: 's1',
        eventDayId: 'd1',
        title: 'Açılış',
        speakerName: '',
        orderIndex: 0,
        sessionType: 'TALK',
      },
    ]);
    (ticketsApi.doorActivity as jest.Mock).mockResolvedValue({ total: 0, items: [] });
    render(<DoorDesk eventId="e1" />);
    await waitFor(() => expect(picker()).toHaveValue('s1'));
    expect(screen.getByRole('option', { name: 'Etkinlik girişi (oturumsuz)' })).toBeInTheDocument();
    await userEvent.setup().selectOptions(picker(), EVENT_DOOR);
    expect(screen.getByText('Etkinlik girişi yazılır; oturum yoklaması yazılmaz.')).toBeVisible();
    expect(screen.getByRole('button', { name: /Misafir QR/ })).toBeDisabled();
  });

  it('names an event that is closed for entries', () => {
    expect(scanRefusal(new ProblemError(403, 'Forbidden', { code: 'event_closed' }))).toMatchObject(
      { kind: 'refused', title: 'Etkinlik girişe kapalı' },
    );
    expect(
      scanRefusal(
        new ProblemError(409, 'Conflict', { code: 'already_entered', fields: { name: 'Ada' } }),
      ),
    ).toMatchObject({
      kind: 'already',
      title: 'Bugün zaten girmiş',
      text: 'Ada bugün etkinliğe girdi.',
    });
  });
});
