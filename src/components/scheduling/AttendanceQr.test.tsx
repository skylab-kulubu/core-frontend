import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AttendanceQr } from '@/components/scheduling/AttendanceQr';
import { ticketsApi } from '@/lib/api/tickets';

jest.mock('@/lib/api/tickets', () => ({
  ticketsApi: { createDoorQr: jest.fn() },
}));

const createDoorQr = ticketsApi.createDoorQr as jest.Mock;

function qr(n: number, sessionQrMode: 'open' | 'qr' = 'open') {
  return {
    token: `t${n}`,
    url: `https://x.example/${n}`,
    svg: `<svg id="qr${n}"/>`,
    use: 'display',
    maxUses: 400,
    sessionQrMode,
    sessionId: 's1',
    eventId: 'e1',
    issuedAt: '2026-11-24T10:00:00Z',
    expiresAt: '2026-11-24T10:01:00Z',
    refreshAfterSeconds: 15,
  };
}

const shown = () => screen.queryByAltText('Oturum yoklaması için QR');

beforeEach(() => {
  jest.useFakeTimers();
  createDoorQr.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('AttendanceQr', () => {
  it('asks core for the display token and renews it every refreshAfterSeconds', async () => {
    createDoorQr.mockResolvedValueOnce(qr(1)).mockResolvedValueOnce(qr(2));
    render(<AttendanceQr sessionId="s1" title="Açılış" />);
    expect(await screen.findByAltText('Oturum yoklaması için QR')).toBeInTheDocument();
    expect(createDoorQr).toHaveBeenCalledWith('s1', 'display');
    expect(shown()?.getAttribute('src')).toContain(encodeURIComponent('<svg id="qr1"/>'));
    expect(screen.getByText(/canlı yayına koyma/)).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(15_000);
    });
    expect(createDoorQr).toHaveBeenCalledTimes(2);
    expect(shown()?.getAttribute('src')).toContain(encodeURIComponent('<svg id="qr2"/>'));
  });

  it("reports core's session QR mode", async () => {
    createDoorQr.mockResolvedValue(qr(1, 'qr'));
    const onMode = jest.fn();
    render(<AttendanceQr sessionId="s1" title="Açılış" onMode={onMode} />);
    await screen.findByAltText('Oturum yoklaması için QR');
    expect(onMode).toHaveBeenCalledWith('qr');
  });

  it('goes full screen for the projector', async () => {
    createDoorQr.mockResolvedValue(qr(1));
    const requestFullscreen = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<AttendanceQr sessionId="s1" title="Açılış" />);
    await screen.findByAltText('Oturum yoklaması için QR');
    await user.click(screen.getByRole('button', { name: 'Tam ekran' }));
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });
});

// ARTLAB's morning (Istanbul = UTC+3).
const program = [
  { id: 'a', title: 'Açılış', startTime: '2026-11-27T08:30:00Z', endTime: '2026-11-27T09:00:00Z' },
  {
    id: 'b',
    title: '1. Oturum',
    startTime: '2026-11-27T09:15:00Z',
    endTime: '2026-11-27T09:45:00Z',
  },
  {
    id: 'c',
    title: '2. Oturum',
    startTime: '2026-11-27T10:00:00Z',
    endTime: '2026-11-27T10:30:00Z',
  },
];

describe('AttendanceQr with the program', () => {
  beforeAll(() => {
    // jsdom has no PointerEvent; base-ui's Switch sends one on a click
    if (!('PointerEvent' in window)) {
      Object.defineProperty(window, 'PointerEvent', { value: MouseEvent, configurable: true });
    }
  });

  beforeEach(() => {
    window.localStorage.clear();
    jest.setSystemTime(new Date('2026-11-27T09:05:00Z'));
    createDoorQr.mockImplementation(async (id: string) => ({ ...qr(1), sessionId: id }));
  });

  it('stays on the session it was opened for until "Programı izle" is turned on', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<AttendanceQr sessionId="a" title="Açılış" program={program} />);
    await screen.findByAltText('Oturum yoklaması için QR');
    expect(createDoorQr).toHaveBeenLastCalledWith('a', 'display');
    expect(screen.getByText('Elle seçildi · Açılış')).toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: /Programı izle/ }));
    // 12:05, between Açılış and 1. Oturum: the next one, said so.
    expect(await screen.findByText('Programı izliyor · 1. Oturum (sıradaki)')).toBeInTheDocument();
    expect(createDoorQr).toHaveBeenLastCalledWith('b', 'display');
    expect(window.localStorage.getItem('attendance-qr-follow')).toBe('on');

    // 12:20: 1. Oturum is running; 12:46: 2. Oturum is next.
    await act(async () => {
      jest.setSystemTime(new Date('2026-11-27T09:20:00Z'));
      jest.advanceTimersByTime(15_000);
    });
    expect(screen.getByText('Programı izliyor · 1. Oturum')).toBeInTheDocument();
    await act(async () => {
      jest.setSystemTime(new Date('2026-11-27T09:46:00Z'));
      jest.advanceTimersByTime(15_000);
    });
    expect(screen.getByText('Programı izliyor · 2. Oturum (sıradaki)')).toBeInTheDocument();
    expect(createDoorQr).toHaveBeenLastCalledWith('c', 'display');
  });

  it('remembers "Programı izle" on this device, and a session picked by hand turns it off', async () => {
    window.localStorage.setItem('attendance-qr-follow', 'on');
    render(<AttendanceQr sessionId="a" title="Açılış" program={program} />);
    expect(await screen.findByText('Programı izliyor · 1. Oturum (sıradaki)')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Oturum' }), { target: { value: 'c' } });
    expect(await screen.findByText('Elle seçildi · 2. Oturum')).toBeInTheDocument();
    expect(createDoorQr).toHaveBeenLastCalledWith('c', 'display');
    expect(window.localStorage.getItem('attendance-qr-follow')).toBe('off');
  });

  it('full screen: shows the mode and the next session, and "Bu oturumda kal" pins it', async () => {
    window.localStorage.setItem('attendance-qr-follow', 'on');
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: jest.fn().mockResolvedValue(undefined),
    });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<AttendanceQr sessionId="a" title="Açılış" program={program} />);
    const img = await screen.findByAltText('Oturum yoklaması için QR');
    await user.click(screen.getByRole('button', { name: 'Tam ekran' }));
    const screenEl = img.parentElement as HTMLElement;
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => screenEl,
    });
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(screen.getByText('Sıradaki: 1. Oturum · 12:15')).toBeInTheDocument();
    expect(screen.getByText('Programı izliyor · 1. Oturum')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bu oturumda kal' })).toBeNull();

    fireEvent.pointerMove(screenEl);
    await user.click(screen.getByRole('button', { name: 'Bu oturumda kal' }));
    expect(screen.getByText('Elle seçildi · 1. Oturum')).toBeInTheDocument();
    expect(window.localStorage.getItem('attendance-qr-follow')).toBe('off');
    // The controls leave after a few seconds.
    act(() => {
      jest.advanceTimersByTime(4_000);
    });
    expect(screen.queryByRole('checkbox', { name: 'Programı izle' })).toBeNull();
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => null });
  });
});
