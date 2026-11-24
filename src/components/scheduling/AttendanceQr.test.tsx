import { act, render, screen } from '@testing-library/react';
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
