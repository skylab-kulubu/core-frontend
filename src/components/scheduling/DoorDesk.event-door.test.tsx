import { render, screen, waitFor, within } from '@testing-library/react';
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

/** A camera that reads `codes` one after another, then nothing, through BarcodeDetector. */
function fakeCamera(codes: string[]) {
  const queue = [...codes];
  class FakeDetector {
    async detect() {
      const next = queue.shift();
      return next ? [{ rawValue: next }] : [];
    }
  }
  (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector = FakeDetector;
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => [{ stop: jest.fn() }] }),
    },
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: () => Promise.resolve(),
  });
  return {
    remove() {
      delete (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector;
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
    },
  };
}

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
    expect(screen.getByText('Bu etkinliğin oturumu yok: kapı alana girişi yazar.')).toBeVisible();
    // One door, nothing to keep apart: no tabs
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Misafir QR/ })).not.toBeInTheDocument();
    // Today's entries and their count
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeVisible());
    expect(screen.getByRole('status', { name: 'Giren sayısı' })).toHaveTextContent(
      'Alana giriş · bugün1',
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

  const withSessions = (mode: 'per_session' | 'venue') => {
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([
      { ...door, effectiveEntryMode: mode },
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
  };

  it('keeps an event run per session to its sessions’ doors', async () => {
    withSessions('per_session');
    render(<DoorDesk eventId="e1" />);
    await waitFor(() => expect(picker()).toHaveValue('s1'));
    expect(screen.queryByRole('option', { name: 'Alana giriş' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    // A session's count reads its attendance, as before
    await waitFor(() => expect(ticketsApi.doorActivity).toHaveBeenCalledWith('s1'));
    expect(ticketsApi.venueEntries).not.toHaveBeenCalled();
  });

  const tab = (name: string) => screen.getByRole('tab', { name });

  /** Turns to Oturum katılımı and takes session s1 through the question. */
  async function attendAt(user: ReturnType<typeof userEvent.setup>) {
    await user.click(tab('Oturum katılımı'));
    await user.selectOptions(picker(), 's1');
    const asked = await screen.findByRole('alertdialog');
    await user.click(within(asked).getByRole('button', { name: 'Oturumu seç' }));
    await waitFor(() => expect(picker()).toHaveValue('s1'));
  }

  it('opens an event run with one entry a day on Alana giriş, its own count and list', async () => {
    withSessions('venue');
    render(<DoorDesk eventId="e1" />);
    await waitFor(() => expect(tab('Alana giriş')).toHaveAttribute('aria-selected', 'true'));
    expect(tab('Oturum katılımı')).toHaveAttribute('aria-selected', 'false');
    // No session to pick and no guest QR here: both are a session's attendance
    expect(screen.queryByLabelText('Oturum')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Misafir QR/ })).not.toBeInTheDocument();
    expect(
      screen.getByText('Okutulan bilet bugünkü alana girişi yazar; oturum katılımı yazılmaz.'),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Giren sayısı' })).toHaveTextContent(
        'Alana giriş · bugün1giren',
      ),
    );
    expect(screen.getByRole('region', { name: 'Son girişler' })).toHaveTextContent(
      'Son alana girişler',
    );
    expect(ticketsApi.doorActivity).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Girişi yaz' })).toBeVisible();
  });

  it('asks before turning the door to a session, naming it, and stays put on Vazgeç', async () => {
    withSessions('venue');
    const user = userEvent.setup();
    render(<DoorDesk eventId="e1" />);
    await waitFor(() => expect(tab('Alana giriş')).toHaveAttribute('aria-selected', 'true'));
    await user.click(tab('Oturum katılımı'));
    expect(picker()).toHaveValue('');
    expect(
      screen.getByText('Oturumu seç: okutulan ya da yazılan herkes o oturuma katılmış sayılır.'),
    ).toBeVisible();
    // Nothing is written before a session is taken
    expect(box()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Katılımı yaz' })).toBeDisabled();

    await user.selectOptions(picker(), 's1');
    const asked = await screen.findByRole('alertdialog');
    expect(asked).toHaveTextContent('"Açılış" oturumuna katılım yazılsın mı?');
    expect(asked).toHaveTextContent(
      'Kapıda alana giriş okutulur. Burada okutulan ya da yazılan herkes bu oturuma katılmış sayılır.',
    );
    await user.click(within(asked).getByRole('button', { name: 'Vazgeç' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(picker()).toHaveValue('');
    expect(ticketsApi.doorActivity).not.toHaveBeenCalled();
  });

  it('counts the session’s attendance apart from the day’s entries, and writes attendance', async () => {
    withSessions('venue');
    (ticketsApi.doorActivity as jest.Mock).mockResolvedValue({
      total: 2,
      items: [
        {
          id: 'ci-1',
          sessionId: 's1',
          eventDayId: 'd1',
          personName: 'Grace Hopper',
          createdAt: new Date(2026, 10, 27, 11, 4, 0).toISOString(),
        },
      ],
    });
    (ticketsApi.venueEntries as jest.Mock).mockResolvedValue([
      entry('v1', 'Grace Hopper'),
      entry('v2', 'Ada Lovelace'),
      entry('v3', 'Alan Turing'),
    ]);
    (ticketsApi.resolveAndCheckIn as jest.Mock).mockResolvedValue({
      id: 'ci-2',
      sessionId: 's1',
      eventDayId: 'd1',
      personName: 'Ada Lovelace',
      createdAt: new Date(2026, 10, 27, 11, 5, 0).toISOString(),
    });
    const user = userEvent.setup();
    render(<DoorDesk eventId="e1" />);
    await waitFor(() => expect(tab('Alana giriş')).toHaveAttribute('aria-selected', 'true'));
    await attendAt(user);
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Katılan sayısı' })).toHaveTextContent(
        'Oturum katılımı2katılan',
      ),
    );
    expect(screen.getByRole('status', { name: 'Alana giren sayısı' })).toHaveTextContent(
      'Alana giriş · bugün3giren',
    );
    expect(screen.getByRole('region', { name: 'Son katılanlar' })).toHaveTextContent(
      'Bu oturuma son katılanlar',
    );
    expect(screen.getByRole('button', { name: /Misafir QR/ })).toBeEnabled();

    await user.type(box(), 'ada{Enter}');
    await waitFor(() =>
      expect(ticketsApi.resolveAndCheckIn).toHaveBeenCalledWith('s1', { query: 'ada' }),
    );
    const result = screen.getByRole('status', { name: 'Giriş sonucu' });
    await waitFor(() => expect(result).toHaveTextContent('Katıldı'));
    expect(result).toHaveTextContent('Ada Lovelace');
    expect(ticketsApi.resolveEntry).not.toHaveBeenCalled();

    // Back to the venue's door: no question, entries again
    await user.click(tab('Alana giriş'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Giren sayısı' })).toHaveTextContent(
        'Alana giriş · bugün3',
      ),
    );
  });

  it('scans for the session’s attendance and says when only the venue entry was written', async () => {
    withSessions('venue');
    const camera = fakeCamera(['TOKEN-1', 'TOKEN-2', 'TOKEN-3']);
    (ticketsApi.scanCheckIn as jest.Mock)
      .mockResolvedValueOnce({
        id: 'ci-1',
        ticketId: 't1',
        sessionId: 's1',
        eventDayId: 'd1',
        kind: 'check_in',
        createdAt: new Date(2026, 10, 27, 11, 4, 0).toISOString(),
      })
      // A core that writes the day's entry alone at a session
      .mockResolvedValueOnce({
        id: 'v9',
        ticketId: 't2',
        sessionId: 's1',
        eventDayId: 'd1',
        kind: 'entry',
        createdAt: new Date(2026, 10, 27, 11, 5, 0).toISOString(),
      })
      .mockRejectedValueOnce(
        new ProblemError(409, 'Conflict', { code: 'already_entered', fields: { name: 'Ada' } }),
      );
    try {
      const user = userEvent.setup();
      render(<DoorDesk eventId="e1" />);
      await waitFor(() => expect(tab('Alana giriş')).toHaveAttribute('aria-selected', 'true'));
      await attendAt(user);
      await user.click(await screen.findByRole('button', { name: 'Kamerayla tara' }));
      await waitFor(() =>
        expect(ticketsApi.scanCheckIn).toHaveBeenCalledWith('s1', 'TOKEN-1', { checkIn: true }),
      );
      const result = screen.getByRole('status', { name: 'Giriş sonucu' });
      await waitFor(() => expect(result).toHaveTextContent('Katıldı'));
      await waitFor(
        () =>
          expect(ticketsApi.scanCheckIn).toHaveBeenCalledWith('s1', 'TOKEN-2', { checkIn: true }),
        { timeout: 2000 },
      );
      await waitFor(() => expect(result).toHaveTextContent('Katılım yazılmadı'));
      expect(result).toHaveTextContent('Yalnız alana giriş yazıldı; katılımı adıyla yaz.');
      await waitFor(
        () =>
          expect(ticketsApi.scanCheckIn).toHaveBeenCalledWith('s1', 'TOKEN-3', { checkIn: true }),
        { timeout: 2000 },
      );
      await waitFor(() =>
        expect(result).toHaveTextContent('Kişi bugün alana girmiş; katılımı adıyla yaz.'),
      );
      expect(result).toHaveTextContent('Katılım yazılmadı');
      expect(result).not.toHaveTextContent('Bugün zaten girmiş');
      expect(ticketsApi.scanEntry).not.toHaveBeenCalled();
    } finally {
      camera.remove();
    }
  });

  it('scans the venue entry on Alana giriş', async () => {
    withSessions('venue');
    const camera = fakeCamera(['TOKEN-1']);
    (ticketsApi.scanEntry as jest.Mock).mockResolvedValue(entry('v5', 'Ada Lovelace'));
    try {
      const user = userEvent.setup();
      render(<DoorDesk eventId="e1" />);
      await waitFor(() => expect(tab('Alana giriş')).toHaveAttribute('aria-selected', 'true'));
      await user.click(await screen.findByRole('button', { name: 'Kamerayla tara' }));
      await waitFor(() => expect(ticketsApi.scanEntry).toHaveBeenCalledWith('e1', 'TOKEN-1'));
      const result = screen.getByRole('status', { name: 'Giriş sonucu' });
      await waitFor(() => expect(result).toHaveTextContent('Girdi'));
      expect(ticketsApi.scanCheckIn).not.toHaveBeenCalled();
    } finally {
      camera.remove();
    }
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
