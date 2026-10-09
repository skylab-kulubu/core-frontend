import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { GuestDoorQr } from '@/components/scheduling/GuestDoorQr';
import { ProblemError } from '@/lib/api/core';
import { ticketsApi } from '@/lib/api/tickets';

jest.mock('@/lib/api/tickets', () => ({
  ticketsApi: { createDoorQr: jest.fn() },
}));

const createDoorQr = ticketsApi.createDoorQr as jest.Mock;

function qr(n: number) {
  return {
    token: `t${n}`,
    url: `https://x.example/${n}`,
    svg: `<svg id="qr${n}"/>`,
    sessionId: 's1',
    eventId: 'e1',
    issuedAt: '2026-10-09T10:00:00Z',
    expiresAt: '2026-10-09T10:01:00Z',
    refreshAfterSeconds: 15,
  };
}

async function open() {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  render(<GuestDoorQr sessionId="s1" />);
  await user.click(screen.getByRole('button', { name: /Misafir QR’ını göster/ }));
}

const shown = () => screen.queryByAltText("Misafir girişi için kapı QR'ı");

beforeEach(() => {
  jest.useFakeTimers();
  createDoorQr.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('GuestDoorQr', () => {
  it('asks for nothing until the door opens it', () => {
    render(<GuestDoorQr sessionId="s1" />);
    expect(createDoorQr).not.toHaveBeenCalled();
  });

  it('shows the QR and renews it every refreshAfterSeconds', async () => {
    createDoorQr.mockResolvedValueOnce(qr(1)).mockResolvedValueOnce(qr(2));
    await open();
    expect(await screen.findByAltText("Misafir girişi için kapı QR'ı")).toBeInTheDocument();
    expect(shown()?.getAttribute('src')).toContain(encodeURIComponent('<svg id="qr1"/>'));

    await act(async () => {
      jest.advanceTimersByTime(15_000);
    });
    expect(createDoorQr).toHaveBeenCalledTimes(2);
    expect(shown()?.getAttribute('src')).toContain(encodeURIComponent('<svg id="qr2"/>'));
  });

  it('takes the QR down when it expires without a renewal', async () => {
    createDoorQr.mockResolvedValueOnce(qr(1)).mockRejectedValue(new Error('network'));
    await open();
    await screen.findByAltText("Misafir girişi için kapı QR'ı");

    await act(async () => {
      jest.advanceTimersByTime(15_000);
    });
    expect(await screen.findByText('QR yenilenemedi.')).toBeInTheDocument();
    expect(shown()).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(45_000);
    });
    expect(shown()).not.toBeInTheDocument();
  });

  it('shows why when the session is closed and shows no QR', async () => {
    createDoorQr.mockRejectedValue(new ProblemError(403, 'Forbidden', { code: 'session_closed' }));
    await open();
    expect(await screen.findByText(/Oturum şu an açık değil/)).toBeInTheDocument();
    expect(shown()).not.toBeInTheDocument();
  });

  it('tells a non-staff person so and stops asking', async () => {
    createDoorQr.mockRejectedValue(new ProblemError(403, 'Forbidden'));
    await open();
    expect(await screen.findByText('Bu etkinlikte görevli değilsin.')).toBeInTheDocument();
    await act(async () => {
      jest.advanceTimersByTime(120_000);
    });
    expect(createDoorQr).toHaveBeenCalledTimes(1);
  });
});
