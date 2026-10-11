import { ProblemError } from '@/lib/api/core';
import { doorQrFailure, svgDataUrl } from '@/lib/door-qr';

describe('svgDataUrl', () => {
  it('encodes the markup so it is safe in an image address', () => {
    const url = svgDataUrl('<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>');
    expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(url).not.toContain('<');
    expect(decodeURIComponent(url.split(',')[1])).toBe(
      '<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>',
    );
  });
});

describe('doorQrFailure', () => {
  it('hides the QR and retries later when the session is closed', () => {
    const failure = doorQrFailure(
      new ProblemError(403, 'Forbidden', { code: 'session_closed' }),
      15,
    );
    expect(failure).toMatchObject({ hideQr: true, retryAfterSeconds: 30 });
    expect(failure.message).toMatch(/Oturum şu an açık değil/);
  });

  it('stops for good when the person is not door staff', () => {
    const failure = doorQrFailure(new ProblemError(403, 'Forbidden'), 15);
    expect(failure).toEqual({
      message: 'Bu etkinlikte görevli değilsin.',
      retryAfterSeconds: null,
      hideQr: true,
    });
  });

  it('keeps the QR until it expires and waits a minute when rate limited', () => {
    expect(doorQrFailure(new ProblemError(429, 'Too Many Requests'), 15)).toMatchObject({
      hideQr: false,
      retryAfterSeconds: 60,
    });
  });

  it('keeps the QR and tries again on the refresh interval for any other failure', () => {
    expect(doorQrFailure(new Error('network'), 15)).toEqual({
      message: 'QR yenilenemedi.',
      retryAfterSeconds: 15,
      hideQr: false,
    });
  });
});
