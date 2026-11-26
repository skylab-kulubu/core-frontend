import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ProblemError } from '@/lib/api/core';
import { DoorDesk } from '@/components/scheduling/DoorDesk';
import { eventDaysApi } from '@/lib/api/eventDays';
import { eventsApi } from '@/lib/api/events';
import { ticketsApi } from '@/lib/api/tickets';
import { resetDoorSoundForTests } from '@/lib/door-feedback';
import { UNDO_GRACE_MS } from '@/lib/ui/use-deferred-undo';

const mockAuthUser = {
  id: 'op',
  username: 'yk',
  email: 'yk@example.com',
  firstName: 'Y',
  lastName: 'K',
  roles: [] as string[],
  groups: ['/UYELER/YK'],
};

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockAuthUser,
  }),
}));

jest.mock('@/lib/api/events', () => ({
  eventsApi: { list: jest.fn() },
}));

// core's capabilities unreadable: the group rule decides (YK edits every event)
jest.mock('@/lib/api/capabilities', () => ({
  capabilitiesApi: { get: jest.fn(() => Promise.reject(new TypeError('Failed to fetch'))) },
}));

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
  },
}));

const event = {
  id: 'e1',
  name: 'SkyDays',
  description: '',
  location: '',
  ownerTeam: 'WEBLAB',
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

/** Lets the few seconds of Vazgeç run out, then goes back to real time. */
async function waitOutUndo() {
  await act(async () => {
    jest.advanceTimersByTime(UNDO_GRACE_MS);
  });
  jest.useRealTimers();
}

/** A camera that reads `codes` one after another, then nothing, through BarcodeDetector. */
function fakeCamera(codes: string[]) {
  const queue = [...codes];
  class FakeDetector {
    async detect() {
      const next = queue.shift();
      return next ? [{ rawValue: next }] : [];
    }
  }
  const track = { stop: jest.fn() };
  (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector = FakeDetector;
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => [track] }) },
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: () => Promise.resolve(),
  });
  return {
    track,
    remove() {
      delete (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector;
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
    },
  };
}

describe('DoorDesk', () => {
  afterEach(() => jest.useRealTimers());

  beforeEach(() => {
    jest.clearAllMocks();
    (eventsApi.list as jest.Mock).mockResolvedValue([event]);
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([event]);
    (eventDaysApi.listByEvent as jest.Mock).mockResolvedValue([
      { id: 'd1', eventId: 'e1', name: 'Gün 1' },
    ]);
    (eventDaysApi.listSessions as jest.Mock).mockResolvedValue([session]);
    (ticketsApi.searchDoorAttendees as jest.Mock).mockResolvedValue([]);
    (ticketsApi.doorActivity as jest.Mock).mockResolvedValue({ total: 0, items: [] });
    (ticketsApi.createDoorQr as jest.Mock).mockReturnValue(new Promise(() => undefined));
    (ticketsApi.resolveAndCheckIn as jest.Mock).mockResolvedValue({
      id: 'ci-new',
      sessionId: 's1',
      eventDayId: 'd1',
      personName: 'Ada Lovelace',
      createdAt: new Date(2026, 8, 19, 9, 4, 0).toISOString(),
    });
  });

  const box = () => screen.getByLabelText('Kişi ya da bilet');
  const ready = () => waitFor(() => expect(screen.getByLabelText('Oturum')).toHaveValue('s1'));

  it('reads the doors and the days in one round, the event being in the address', async () => {
    let doors: (rows: unknown[]) => void = () => undefined;
    (ticketsApi.listDoorEvents as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        doors = resolve;
      }),
    );
    render(<DoorDesk eventId="e1" />);
    // The days are asked for before the doors answer
    expect(eventDaysApi.listByEvent).toHaveBeenCalledWith('e1');
    await act(async () => doors([event]));
    await ready();
  });

  it('offers Oturum QR and, for who may choose them, the door staff beside the way back', async () => {
    render(<DoorDesk eventId="e1" />);
    await ready();
    expect(screen.getByRole('button', { name: 'Oturum QR' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Kapı görevlileri' })).toHaveAttribute(
      'href',
      '/events/e1/checkin#kapi-gorevlileri',
    );
  });

  it('writes an entry from one box and says it large, with the way back', async () => {
    const user = userEvent.setup();
    render(<DoorDesk eventId="e1" />);
    await ready();
    await user.type(box(), 'ada@example.com{Enter}');
    await waitFor(() =>
      expect(ticketsApi.resolveAndCheckIn).toHaveBeenCalledWith('s1', { query: 'ada@example.com' }),
    );
    const result = screen.getByRole('status', { name: 'Giriş sonucu' });
    expect(result).toHaveTextContent('Girdi');
    expect(result).toHaveTextContent('Ada Lovelace');
    expect(within(result).getByRole('button', { name: 'Geri al' })).toBeInTheDocument();
    expect(box()).toHaveValue('');
    expect(screen.getByRole('status', { name: 'Giren sayısı' })).toHaveTextContent('1');
  });

  it('offers the matching people under the box and writes the one pressed', async () => {
    const user = userEvent.setup();
    (ticketsApi.searchDoorAttendees as jest.Mock).mockResolvedValue([
      { personId: 'u-ada', name: 'Ada Lovelace', email: 'ada@example.com' },
      { name: 'Grace Hopper', email: 'grace@example.com' },
    ]);
    render(<DoorDesk eventId="e1" />);
    await ready();
    await user.type(box(), 'ad');
    const list = await screen.findByRole('list', { name: 'Eşleşen kişiler' });
    await user.click(within(list).getByRole('button', { name: /Grace Hopper/ }));
    await waitFor(() =>
      expect(ticketsApi.resolveAndCheckIn).toHaveBeenCalledWith('s1', {
        query: 'grace@example.com',
      }),
    );
    await user.type(box(), 'ad');
    await user.click(
      within(await screen.findByRole('list', { name: 'Eşleşen kişiler' })).getByRole('button', {
        name: /Ada Lovelace/,
      }),
    );
    await waitFor(() =>
      expect(ticketsApi.resolveAndCheckIn).toHaveBeenCalledWith('s1', { personId: 'u-ada' }),
    );
  });

  it('takes an entry back after a few seconds with Vazgeç, from the band and the last entries', async () => {
    (ticketsApi.undoCheckIn as jest.Mock).mockResolvedValue(undefined);
    (ticketsApi.doorActivity as jest.Mock).mockResolvedValue({
      total: 5,
      items: [
        {
          id: 'ci-1',
          sessionId: 's1',
          eventDayId: 'd1',
          personName: 'Grace Hopper',
          createdAt: '2026-09-19T08:05:00.000Z',
        },
      ],
    });
    render(<DoorDesk eventId="e1" />);
    await ready();
    const row = await screen.findByRole('button', { name: 'Grace Hopper: girişi geri al' });
    jest.useFakeTimers();
    let user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.click(row);
    // Not at the first press: the row waits with Vazgeç, and a toast says so
    expect(ticketsApi.undoCheckIn).not.toHaveBeenCalled();
    expect(screen.getByText('Grace Hopper: giriş geri alınıyor')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Grace Hopper: geri almaktan vazgeç' }),
    ).toBeInTheDocument();
    await waitOutUndo();
    await waitFor(() => expect(ticketsApi.undoCheckIn).toHaveBeenCalledWith('s1', 'ci-1'));
    expect(await screen.findByText('Geri alındı')).toBeInTheDocument();

    user = userEvent.setup();
    await user.type(box(), 'ada{Enter}');
    const result = await screen.findByRole('status', { name: 'Giriş sonucu' });
    await waitFor(() => expect(result).toHaveTextContent('Girdi'));
    jest.useFakeTimers();
    user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.click(within(result).getByRole('button', { name: 'Geri al' }));
    expect(
      within(result).getByRole('button', { name: 'Geri almaktan vazgeç' }),
    ).toBeInTheDocument();
    await waitOutUndo();
    await waitFor(() => expect(ticketsApi.undoCheckIn).toHaveBeenLastCalledWith('s1', 'ci-new'));
  });

  it('keeps the entry when Vazgeç is pressed in the few seconds', async () => {
    render(<DoorDesk eventId="e1" />);
    await ready();
    let user = userEvent.setup();
    await user.type(box(), 'ada{Enter}');
    const result = screen.getByRole('status', { name: 'Giriş sonucu' });
    await waitFor(() => expect(result).toHaveTextContent('Girdi'));
    jest.useFakeTimers();
    user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.click(within(result).getByRole('button', { name: 'Geri al' }));
    await user.click(within(result).getByRole('button', { name: 'Geri almaktan vazgeç' }));
    await waitOutUndo();
    expect(ticketsApi.undoCheckIn).not.toHaveBeenCalled();
    expect(result).toHaveTextContent('Girdi');
    expect(within(result).getByRole('button', { name: 'Geri al' })).toBeInTheDocument();
  });

  it('says so when core cannot take the entry back', async () => {
    let user = userEvent.setup();
    (ticketsApi.undoCheckIn as jest.Mock).mockRejectedValue(new ProblemError(404, 'Not Found'));
    render(<DoorDesk eventId="e1" />);
    await ready();
    await user.type(box(), 'ada{Enter}');
    const result = screen.getByRole('status', { name: 'Giriş sonucu' });
    await waitFor(() => expect(result).toHaveTextContent('Girdi'));
    jest.useFakeTimers();
    user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.click(within(result).getByRole('button', { name: 'Geri al' }));
    await waitOutUndo();
    await waitFor(() => expect(result).toHaveTextContent('Girmedi'));
  });

  it('writes what the camera reads and keeps the camera open for the next code', async () => {
    const camera = fakeCamera(['TOKEN-1', 'TOKEN-2']);
    (ticketsApi.scanCheckIn as jest.Mock)
      .mockResolvedValueOnce({
        id: 'ci-scan-1',
        ticketId: 't1',
        sessionId: 's1',
        eventDayId: 'd1',
        createdAt: new Date(2026, 8, 19, 9, 6, 0).toISOString(),
      })
      .mockResolvedValueOnce({
        id: 'ci-scan-2',
        ticketId: 't2',
        sessionId: 's1',
        eventDayId: 'd1',
        createdAt: new Date(2026, 8, 19, 9, 7, 0).toISOString(),
      });
    // core's list of entries names the holder the scan answer leaves out
    (ticketsApi.doorActivity as jest.Mock).mockImplementation(async () => {
      const calls = (ticketsApi.scanCheckIn as jest.Mock).mock.calls.length;
      const items = [
        { id: 'ci-scan-1', name: 'Ada Lovelace' },
        { id: 'ci-scan-2', name: 'Grace Hopper' },
      ]
        .slice(0, calls)
        .reverse()
        .map((row) => ({
          id: row.id,
          sessionId: 's1',
          eventDayId: 'd1',
          personName: row.name,
          createdAt: '2026-09-19T06:06:00.000Z',
        }));
      return { total: items.length, items };
    });
    try {
      const user = userEvent.setup();
      render(<DoorDesk eventId="e1" />);
      await ready();
      await user.click(await screen.findByRole('button', { name: 'Kamerayla tara' }));
      await waitFor(() => expect(ticketsApi.scanCheckIn).toHaveBeenCalledWith('s1', 'TOKEN-1'));
      const result = screen.getByRole('status', { name: 'Giriş sonucu' });
      await waitFor(() => expect(result).toHaveTextContent('Ada Lovelace'));
      // The camera did not close after the first code: the next one is read too
      await waitFor(() => expect(ticketsApi.scanCheckIn).toHaveBeenCalledWith('s1', 'TOKEN-2'), {
        timeout: 2000,
      });
      await waitFor(() => expect(result).toHaveTextContent('Grace Hopper'));
      expect(screen.getByRole('region', { name: 'Kamerayla tara' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Kamerayı kapat' })).toBeInTheDocument();
      expect(camera.track.stop).not.toHaveBeenCalled();
      expect(ticketsApi.scanCheckIn).toHaveBeenCalledTimes(2);
    } finally {
      camera.remove();
    }
  });

  it('covers the screen with the result of each code, vibrates, and keeps the camera reading', async () => {
    const vibrate = jest.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
    const camera = fakeCamera(['TOKEN-1', 'TOKEN-OLD']);
    (ticketsApi.scanCheckIn as jest.Mock)
      .mockResolvedValueOnce({
        id: 'ci-scan-1',
        ticketId: 't1',
        sessionId: 's1',
        eventDayId: 'd1',
        createdAt: new Date(2026, 8, 19, 9, 6, 0).toISOString(),
      })
      .mockRejectedValueOnce(
        new ProblemError(410, 'Gone', { code: 'ticket_qr_superseded', detail: 'yenilenmiş' }),
      );
    (ticketsApi.doorActivity as jest.Mock).mockImplementation(async () =>
      (ticketsApi.scanCheckIn as jest.Mock).mock.calls.length
        ? {
            total: 1,
            items: [
              {
                id: 'ci-scan-1',
                sessionId: 's1',
                eventDayId: 'd1',
                personName: 'Ada Lovelace',
                createdAt: '2026-09-19T06:06:00.000Z',
              },
            ],
          }
        : { total: 0, items: [] },
    );
    try {
      const user = userEvent.setup();
      render(<DoorDesk eventId="e1" />);
      await ready();
      await user.click(await screen.findByRole('button', { name: 'Kamerayla tara' }));
      // Green, with its icon and words, the name arriving from the list of entries
      const flash = await screen.findByTestId('door-flash');
      expect(flash).toHaveAttribute('data-signal', 'in');
      expect(flash).toHaveTextContent('Giriş yazıldı');
      await waitFor(() =>
        expect(screen.getByTestId('door-flash')).toHaveTextContent('Ada Lovelace'),
      );
      expect(vibrate).toHaveBeenCalledWith(120);
      // The next code, a renewed ticket: red, said in words; the band says it to screen readers
      await waitFor(
        () => expect(screen.getByTestId('door-flash')).toHaveAttribute('data-signal', 'refused'),
        { timeout: 4000 },
      );
      expect(screen.getByTestId('door-flash')).toHaveTextContent('Bilet yenilenmiş');
      expect(screen.getByTestId('door-flash')).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getByRole('status', { name: 'Giriş sonucu' })).toHaveTextContent(
        'Bilet yenilenmiş',
      );
      expect(vibrate).toHaveBeenLastCalledWith([300, 100, 300]);
      // A tap closes it; the camera is still open for the next code
      await user.click(screen.getByTestId('door-flash'));
      expect(screen.queryByTestId('door-flash')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Kamerayı kapat' })).toBeInTheDocument();
      expect(camera.track.stop).not.toHaveBeenCalled();
    } finally {
      camera.remove();
      Object.defineProperty(navigator, 'vibrate', { configurable: true, value: undefined });
    }
  });

  it('closes the result with Escape, and wakes the sound on a tap and when the door comes back', async () => {
    const resume = jest.fn();
    const contexts: Array<{ state: string }> = [];
    class FakeAudioContext {
      state = 'suspended';
      resume = async () => {
        resume();
        this.state = 'running';
      };
      constructor() {
        contexts.push(this);
      }
    }
    (window as unknown as { AudioContext?: unknown }).AudioContext = FakeAudioContext;
    resetDoorSoundForTests();
    // A second code about 1.5 s after the first (each empty read is one 250 ms frame)
    const camera = fakeCamera(['TOKEN-1', '', '', '', '', '', '', 'TOKEN-2']);
    (ticketsApi.scanCheckIn as jest.Mock).mockRejectedValue(new ProblemError(409, 'Conflict'));
    try {
      const user = userEvent.setup();
      render(<DoorDesk eventId="e1" />);
      await ready();
      await user.click(await screen.findByRole('button', { name: 'Kamerayla tara' }));
      expect(resume).toHaveBeenCalledTimes(1);
      expect(await screen.findByTestId('door-flash')).toHaveAttribute('data-signal', 'already');
      await user.keyboard('{Escape}');
      expect(screen.queryByTestId('door-flash')).not.toBeInTheDocument();

      // The phone locked: the sound is interrupted; a tap on the next result wakes it
      contexts[0].state = 'interrupted';
      const next = await screen.findByTestId('door-flash', {}, { timeout: 4000 });
      await user.click(next);
      expect(resume).toHaveBeenCalledTimes(2);

      // Back from another app: the door wakes it when it is in view again
      contexts[0].state = 'interrupted';
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(resume).toHaveBeenCalledTimes(3);
    } finally {
      camera.remove();
      delete (window as unknown as { AudioContext?: unknown }).AudioContext;
      resetDoorSoundForTests();
    }
  });

  it('turns the beep off and on, and remembers it on this device', async () => {
    const camera = fakeCamera([]);
    window.localStorage.clear();
    try {
      const user = userEvent.setup();
      render(<DoorDesk eventId="e1" />);
      await ready();
      const sound = await screen.findByRole('button', { name: 'Ses' });
      expect(sound).toHaveAttribute('aria-pressed', 'true');
      await user.click(sound);
      expect(sound).toHaveAttribute('aria-pressed', 'false');
      expect(window.localStorage.getItem('door-sound')).toBe('off');
      await user.click(sound);
      expect(sound).toHaveAttribute('aria-pressed', 'true');
      expect(window.localStorage.getItem('door-sound')).toBe('on');
    } finally {
      camera.remove();
    }
  });

  it('names the search box by its label alone, the button standing outside it', async () => {
    render(<DoorDesk eventId="e1" />);
    await ready();
    expect(screen.getByRole('searchbox')).toHaveAccessibleName('Kişi ya da bilet');
  });

  it('shows the running session as selected and writes to that same session', async () => {
    const user = userEvent.setup();
    const hour = 3600_000;
    const iso = (offset: number) => new Date(Date.now() + offset).toISOString();
    (eventDaysApi.listSessions as jest.Mock).mockResolvedValue([
      { ...session, startTime: iso(-3 * hour), endTime: iso(-2 * hour) },
      { ...session, id: 's2', title: 'Panel', startTime: iso(-hour), endTime: iso(hour) },
    ]);
    render(<DoorDesk eventId="e1" />);
    const picker = await screen.findByLabelText('Oturum');
    await waitFor(() => expect(picker).toHaveValue('s2'));
    expect(screen.getByRole('status', { name: 'Giren sayısı' })).toHaveTextContent('Panel');
    await user.type(box(), 'ada{Enter}');
    await waitFor(() =>
      expect(ticketsApi.resolveAndCheckIn).toHaveBeenCalledWith('s2', expect.anything()),
    );
  });

  it('notes, without blocking, that the chosen session has not started yet', async () => {
    const hour = 3600_000;
    (eventDaysApi.listSessions as jest.Mock).mockResolvedValue([
      {
        ...session,
        startTime: new Date(Date.now() + 2 * hour).toISOString(),
        endTime: new Date(Date.now() + 3 * hour).toISOString(),
      },
    ]);
    render(<DoorDesk eventId="e1" />);
    await ready();
    expect(screen.getByLabelText('Oturum')).toHaveAccessibleDescription(
      /Bu oturum henüz başlamadı \(başlangıç .*\); misafir QR’ı şimdiden açık\./,
    );
    expect(box()).toBeEnabled();
  });

  it('makes staff pick a session when several exist and none is running', async () => {
    const user = userEvent.setup();
    (eventDaysApi.listSessions as jest.Mock).mockResolvedValue([
      session,
      { ...session, id: 's2', title: 'Panel' },
    ]);
    render(<DoorDesk eventId="e1" />);
    await screen.findByRole('option', { name: /Panel/ });
    expect(screen.getByLabelText('Oturum')).toHaveValue('');
    expect(screen.getByText(/Şu an süren oturum yok/)).toBeInTheDocument();
    expect(box()).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Oturum'), 's2');
    await user.type(box(), 'ada{Enter}');
    await waitFor(() =>
      expect(ticketsApi.resolveAndCheckIn).toHaveBeenCalledWith('s2', { query: 'ada' }),
    );
  });

  it('asks for something to look for before writing', async () => {
    const user = userEvent.setup();
    render(<DoorDesk eventId="e1" />);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Girişi yaz' }));
    expect(ticketsApi.resolveAndCheckIn).not.toHaveBeenCalled();
    expect(screen.getByRole('status', { name: 'Giriş sonucu' })).toHaveTextContent(
      'Ad, e-posta ya da bilet kodu yaz.',
    );
  });

  it('announces event loading failures instead of showing an empty authorization state', async () => {
    (ticketsApi.listDoorEvents as jest.Mock).mockRejectedValue(new Error('offline'));
    render(<DoorDesk eventId="e1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Etkinlikler yüklenemedi');
  });

  it('opens no desk for an event that is not among the person’s doors', async () => {
    render(<DoorDesk eventId="e9" />);
    expect(await screen.findByText('Bu etkinliğin kapısında görevin yok')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Girişi yaz' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Etkinliğe dön' })).toHaveAttribute(
      'href',
      '/events/e9',
    );
    expect(eventsApi.list).not.toHaveBeenCalled();
  });

  it('shows the live count and the last entries, and clears a passing error', async () => {
    let refresh: (() => void) | undefined;
    const interval = jest.spyOn(window, 'setInterval').mockImplementation((handler) => {
      refresh = handler as () => void;
      return {} as ReturnType<typeof setInterval>;
    });
    (ticketsApi.doorActivity as jest.Mock)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({
        total: 12,
        items: [
          {
            id: 'ci-1',
            sessionId: 's1',
            eventDayId: 'd1',
            personName: 'Grace Hopper',
            createdAt: '2026-09-19T08:05:00.000Z',
          },
        ],
      });
    render(<DoorDesk eventId="e1" />);
    expect(await screen.findByText('Son girişler yüklenemedi')).toBeInTheDocument();
    await act(async () => refresh?.());
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Giren sayısı' })).toHaveTextContent('12'),
    );
    expect(screen.queryByText('Son girişler yüklenemedi')).not.toBeInTheDocument();
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    interval.mockRestore();
  });

  it('says the person is already in when core refuses a second entry', async () => {
    const user = userEvent.setup();
    (ticketsApi.resolveAndCheckIn as jest.Mock).mockRejectedValue(
      new ProblemError(409, 'Conflict', { detail: 'Conflict' }),
    );
    render(<DoorDesk eventId="e1" />);
    await ready();
    await user.type(box(), 'ada{Enter}');
    const result = screen.getByRole('status', { name: 'Giriş sonucu' });
    await waitFor(() => expect(result).toHaveTextContent('Zaten girmiş'));
    expect(result).toHaveTextContent('Bu kişi bu oturuma zaten girmiş.');
  });

  it('says a cancelled or waitlisted ticket in red, not as already in', async () => {
    const user = userEvent.setup();
    (ticketsApi.resolveAndCheckIn as jest.Mock).mockRejectedValueOnce(
      new ProblemError(409, 'Conflict', { code: 'ticket_cancelled' }),
    );
    render(<DoorDesk eventId="e1" />);
    await ready();
    await user.type(box(), 'ada{Enter}');
    const result = screen.getByRole('status', { name: 'Giriş sonucu' });
    await waitFor(() => expect(result).toHaveTextContent('Bilet iptal edilmiş'));
    expect(result).not.toHaveTextContent('Zaten girmiş');
    expect(result.firstElementChild).toHaveClass('bg-destructive/15');

    (ticketsApi.resolveAndCheckIn as jest.Mock).mockRejectedValueOnce(
      new ProblemError(409, 'Conflict', { code: 'ticket_waitlisted' }),
    );
    await user.type(box(), 'ada{Enter}');
    await waitFor(() => expect(result).toHaveTextContent('Bilet bekleme listesinde'));
    expect(result.firstElementChild).toHaveClass('bg-destructive/15');
  });

  it('shows a scanned cancelled ticket red over the whole screen', async () => {
    const camera = fakeCamera(['TOKEN-1']);
    (ticketsApi.scanCheckIn as jest.Mock).mockRejectedValue(
      new ProblemError(409, 'Conflict', { code: 'ticket_cancelled' }),
    );
    try {
      const user = userEvent.setup();
      render(<DoorDesk eventId="e1" />);
      await ready();
      await user.click(await screen.findByRole('button', { name: 'Kamerayla tara' }));
      const flash = await screen.findByTestId('door-flash');
      expect(flash).toHaveAttribute('data-signal', 'refused');
      expect(flash).toHaveTextContent('Bilet iptal edilmiş');
    } finally {
      camera.remove();
    }
  });

  it('says a refused entry in Turkish, never core’s English', async () => {
    const user = userEvent.setup();
    (ticketsApi.resolveAndCheckIn as jest.Mock).mockRejectedValue(
      new ProblemError(422, 'Unprocessable Entity', {
        detail: 'query matched more than one ticket for this session',
      }),
    );
    render(<DoorDesk eventId="e1" />);
    await ready();
    await user.type(box(), 'Ada{Enter}');
    const result = screen.getByRole('status', { name: 'Giriş sonucu' });
    await waitFor(() => expect(result).toHaveTextContent('Girmedi'));
    expect(document.body).not.toHaveTextContent(/matched more than one|Unprocessable/);
  });

  it('opens the guest QR from its own button', async () => {
    const user = userEvent.setup();
    render(<DoorDesk eventId="e1" />);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Misafir QR’ı' }));
    expect(screen.getByRole('region', { name: "Misafir QR'ı" })).toBeInTheDocument();
    expect(ticketsApi.createDoorQr).toHaveBeenCalledWith('s1', 'door');
  });
});
