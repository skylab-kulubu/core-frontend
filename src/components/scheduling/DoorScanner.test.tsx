import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { DoorScanner, canScanWithCamera } from '@/components/scheduling/DoorScanner';

const mockQrScanner = {
  NO_QR_CODE_FOUND: 'No QR code found',
  createQrEngine: jest.fn(),
  scanImage: jest.fn(),
};

jest.mock('qr-scanner', () => ({ __esModule: true, default: mockQrScanner }));

type Global = { BarcodeDetector?: unknown; Worker?: unknown };

/** The decoding worker qr-scanner would start (jsdom has none). */
class FakeWorker {
  terminate = jest.fn();
}

/** A back camera whose video already has a frame, as on a phone a moment after play. */
function fakeCamera(getUserMedia?: jest.Mock) {
  const track = { stop: jest.fn() };
  const ask = getUserMedia ?? jest.fn().mockResolvedValue({ getTracks: () => [track] });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: ask },
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: () => Promise.resolve(),
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
    configurable: true,
    get: () => 4,
  });
  return { track, getUserMedia: ask };
}

describe('DoorScanner', () => {
  const global = window as unknown as Global;

  beforeEach(() => {
    jest.clearAllMocks();
    delete global.BarcodeDetector;
    global.Worker = FakeWorker;
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.BarcodeDetector;
    delete global.Worker;
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
  });

  it('offers the camera without BarcodeDetector (Safari on iPhone), not on a page without one', () => {
    expect(canScanWithCamera()).toBe(false);
    fakeCamera();
    expect(canScanWithCamera()).toBe(true);
  });

  it('reads with the worker reader when BarcodeDetector is missing, the same code once per 3 s', async () => {
    jest.useFakeTimers();
    const camera = fakeCamera();
    const worker = new FakeWorker();
    mockQrScanner.createQrEngine.mockResolvedValue(worker);
    mockQrScanner.scanImage
      .mockRejectedValueOnce(mockQrScanner.NO_QR_CODE_FOUND)
      .mockResolvedValue({ data: ' TOKEN-1 ', cornerPoints: [] });
    const onScan = jest.fn();

    const { unmount } = render(<DoorScanner onScan={onScan} onClose={() => undefined} />);
    await waitFor(() => expect(mockQrScanner.scanImage).toHaveBeenCalled());
    expect(camera.getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: 'environment' },
      audio: false,
    });
    const [source, options] = mockQrScanner.scanImage.mock.calls[0];
    expect(source).toBeInstanceOf(HTMLVideoElement);
    expect(source).toHaveAttribute('playsinline');
    expect(options).toMatchObject({ qrEngine: worker, returnDetailedScanResult: true });

    // The ticket stays in view for a second: one entry
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('TOKEN-1');
    expect(mockQrScanner.scanImage.mock.calls.length).toBeGreaterThan(3);

    // Still held up after 3 s: read again
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3000);
    });
    expect(onScan).toHaveBeenCalledTimes(2);

    unmount();
    expect(camera.track.stop).toHaveBeenCalled();
    expect(worker.terminate).toHaveBeenCalled();
  });

  it('uses BarcodeDetector where there is one and never loads the fallback', async () => {
    fakeCamera();
    class FakeDetector {
      async detect() {
        return [{ rawValue: 'TOKEN-2' }];
      }
    }
    global.BarcodeDetector = FakeDetector;
    const onScan = jest.fn();

    render(<DoorScanner onScan={onScan} onClose={() => undefined} />);
    await waitFor(() => expect(onScan).toHaveBeenCalledWith('TOKEN-2'));
    expect(mockQrScanner.createQrEngine).not.toHaveBeenCalled();
    expect(mockQrScanner.scanImage).not.toHaveBeenCalled();
  });

  it('says how to allow the camera when permission is refused', async () => {
    const refused = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    fakeCamera(jest.fn().mockRejectedValue(refused));
    mockQrScanner.createQrEngine.mockResolvedValue(new FakeWorker());

    render(<DoorScanner onScan={jest.fn()} onClose={() => undefined} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Kamera izni verilmedi. Tarayıcının site ayarlarından kameraya izin verip tekrar dene.',
    );
  });

  it('lets the camera go and says so when the reader cannot be loaded', async () => {
    const camera = fakeCamera();
    mockQrScanner.createQrEngine.mockRejectedValue(new Error('chunk load failed'));

    render(<DoorScanner onScan={jest.fn()} onClose={() => undefined} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Kod okuyucu yüklenemedi. Kodu elle yaz.',
    );
    expect(camera.track.stop).toHaveBeenCalled();
    expect(mockQrScanner.scanImage).not.toHaveBeenCalled();
  });
});
