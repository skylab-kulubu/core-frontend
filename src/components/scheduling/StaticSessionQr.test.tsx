import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { StaticSessionQr } from '@/components/scheduling/StaticSessionQr';
import { ProblemError } from '@/lib/api/core';
import { ticketsApi } from '@/lib/api/tickets';
import { qrPngBlob, saveBlob } from '@/lib/qr-png';

jest.mock('@/lib/api/tickets', () => ({
  ticketsApi: { createDoorQr: jest.fn() },
}));
jest.mock('@/lib/qr-png', () => ({
  qrPngBlob: jest.fn(),
  saveBlob: jest.fn(),
}));

const createDoorQr = ticketsApi.createDoorQr as jest.Mock;

const staticQr = {
  token: 'v1.s.abc',
  url: 'https://yildizskylab.com/kapi/s1?dq=v1.s.abc',
  svg: '<svg id="static"/>',
  use: 'static',
  maxUses: 0,
  sessionQrMode: 'open',
  sessionId: 's1',
  eventId: 'e1',
  issuedAt: '2026-11-26T15:00:00Z',
  expiresAt: '2026-11-27T21:00:00Z',
  refreshAfterSeconds: 0,
  validFrom: '2026-11-26T20:30:00Z',
  validUntil: '2026-11-27T21:00:00Z',
};

beforeEach(() => {
  createDoorQr.mockReset();
  (qrPngBlob as jest.Mock).mockReset();
  (saveBlob as jest.Mock).mockReset();
});

describe('StaticSessionQr', () => {
  it('asks core for the static QR only when asked, and shows when it is valid', async () => {
    createDoorQr.mockResolvedValue(staticQr);
    const user = userEvent.setup();
    render(<StaticSessionQr sessionId="s1" title="Açılış" />);
    expect(createDoorQr).not.toHaveBeenCalled();
    expect(screen.getByText('Sabit QR (yazdır/ekran)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sabit QR’ı göster' }));
    const img = await screen.findByAltText("Oturumun sabit yoklama QR'ı");
    expect(createDoorQr).toHaveBeenCalledWith('s1', 'static');
    expect(img.getAttribute('src')).toContain(encodeURIComponent('<svg id="static"/>'));
    expect(screen.getByText('Geçerli: 26 Kas 23:30 – 28 Kas 00:00')).toBeInTheDocument();
    expect(screen.getByText(/Canlı yayına koyma/)).toBeInTheDocument();
  });

  it('goes full screen and saves a PNG named after the session', async () => {
    createDoorQr.mockResolvedValue(staticQr);
    const blob = new Blob(['png']);
    (qrPngBlob as jest.Mock).mockResolvedValue(blob);
    const requestFullscreen = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });
    const user = userEvent.setup();
    render(<StaticSessionQr sessionId="s1" title="Açılış" />);
    await user.click(screen.getByRole('button', { name: 'Sabit QR’ı göster' }));
    await screen.findByAltText("Oturumun sabit yoklama QR'ı");
    await user.click(screen.getByRole('button', { name: 'Tam ekran' }));
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'PNG indir' }));
    expect(qrPngBlob).toHaveBeenCalledWith('<svg id="static"/>', 'Açılış');
    expect(saveBlob).toHaveBeenCalledWith(blob, 'oturum-Açılış-sabit.png');
  });

  it('says why core gave none', async () => {
    createDoorQr.mockRejectedValue(
      new ProblemError(400, 'Bad Request', { code: 'session_times_required' }),
    );
    const user = userEvent.setup();
    render(<StaticSessionQr sessionId="s1" title="Açılış" />);
    await user.click(screen.getByRole('button', { name: 'Sabit QR’ı göster' }));
    expect(
      await screen.findByText('Sabit QR için oturumun başlangıç ve bitiş saati olmalı.'),
    ).toBeInTheDocument();
    expect(screen.queryByAltText("Oturumun sabit yoklama QR'ı")).toBeNull();
  });
});
