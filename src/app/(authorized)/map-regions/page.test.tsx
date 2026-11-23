import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import MapRegionsPage, { REGION_POLL_MS } from '@/app/(authorized)/map-regions/page';
import { ProblemError } from '@/lib/api/core';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { mapRegionsApi, type MapRegion } from '@/lib/api/map-regions';

// The address is the list's state (the open row too): the hook writes history, this reads it back
const mockListeners = new Set<() => void>();
function mockSubscribe(listener: () => void) {
  mockListeners.add(listener);
  return () => mockListeners.delete(listener);
}
for (const method of ['pushState', 'replaceState'] as const) {
  const original = window.history[method].bind(window.history);
  window.history[method] = (...args: Parameters<History['pushState']>) => {
    original(...args);
    mockListeners.forEach((listener) => listener());
  };
}
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/map-regions',
  useSearchParams: () => {
    const { useSyncExternalStore } = jest.requireActual('react') as typeof import('react');
    const text = useSyncExternalStore(
      mockSubscribe,
      () => window.location.search,
      () => '',
    );
    return new URLSearchParams(text);
  },
}));

type User = ReturnType<typeof userEvent.setup>;

/** Opens a region's row in the side panel and gives the panel. */
async function open(user: User, name: string): Promise<HTMLElement> {
  await user.click(await screen.findByRole('button', { name }));
  return screen.findByRole('dialog', { name });
}

jest.mock('@/lib/api/capabilities', () => ({
  capabilitiesApi: { get: jest.fn() },
}));

jest.mock('@/lib/api/map-regions', () => ({
  ...jest.requireActual('@/lib/api/map-regions'),
  mapRegionsApi: { list: jest.fn(), request: jest.fn(), retry: jest.fn(), retire: jest.fn() },
}));

const istanbul: MapRegion = {
  id: 'r1',
  name: 'İstanbul',
  bbox: [27.95, 40.8, 29.95, 41.6],
  maxZoom: 15,
  status: 'ready',
  sizeBytes: 78_643_200,
  progressBytes: 78_643_200,
  sourceBuild: '20261122',
  url: 'https://cdn.test/maps/istanbul.pmtiles',
  createdAt: '2026-11-22T15:00:00Z',
};
const ankara: MapRegion = {
  id: 'r2',
  name: 'Ankara',
  bbox: [32.4, 39.7, 33.1, 40.1],
  maxZoom: 15,
  status: 'extracting',
  sizeBytes: 200,
  progressBytes: 50,
  createdAt: '2026-11-22T17:00:00Z',
};
const kocaeli: MapRegion = {
  id: 'r3',
  name: 'Kocaeli',
  bbox: [29.3, 40.5, 30.4, 41.2],
  maxZoom: 15,
  status: 'failed',
  errorCode: 'source_unavailable',
  progressBytes: 0,
  createdAt: '2026-11-22T16:00:00Z',
};

describe('Harita bölgeleri', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState(null, '', '/map-regions');
    (mapRegionsApi.list as jest.Mock).mockResolvedValue([ankara, kocaeli, istanbul]);
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'media.delete': true } });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('lists the regions with their state, size and progress, and sums them up top', async () => {
    render(<MapRegionsPage />);
    expect(await screen.findByRole('button', { name: 'İstanbul' })).toBeInTheDocument();
    expect(screen.getAllByText('75,0 MB')).toHaveLength(2);
    expect(screen.getByRole('progressbar', { name: 'Ankara hazırlanıyor' })).toHaveAttribute(
      'aria-valuenow',
      '25',
    );
    expect(screen.getByText('Kaynak okunamadı')).toBeInTheDocument();
    // No raw box or build number in the row any more
    expect(screen.queryByText(/yapım 20261122/)).not.toBeInTheDocument();
    const figures = screen.getByRole('group', { name: 'Özet' });
    expect(within(figures).getByRole('button', { name: /Hazır\s*1/ })).toBeInTheDocument();
    expect(within(figures).getByRole('button', { name: /Hata\s*1/ })).toBeInTheDocument();
    expect(within(figures).getByText('75,0 MB')).toBeInTheDocument();
  });

  it('opens a region beside the list with its box, build and dates', async () => {
    const user = userEvent.setup();
    render(<MapRegionsPage />);
    const panel = await open(user, 'İstanbul');
    expect(
      within(panel).getByRole('img', { name: /İstanbul: Türkiye içindeki kapsamı/ }),
    ).toBeInTheDocument();
    expect(within(panel).getByText('27,95 – 29,95 · 40,80 – 41,60')).toBeInTheDocument();
    expect(within(panel).getByText('20261122')).toBeInTheDocument();
    expect(window.location.search).toBe('?panel=r1');
  });

  it('reads the list again while a region is being prepared', async () => {
    jest.useFakeTimers();
    render(<MapRegionsPage />);
    await act(async () => undefined);
    expect(mapRegionsApi.list).toHaveBeenCalledTimes(1);
    (mapRegionsApi.list as jest.Mock).mockResolvedValue([{ ...ankara, status: 'ready', url: 'x' }]);
    await act(async () => {
      jest.advanceTimersByTime(REGION_POLL_MS);
    });
    expect(mapRegionsApi.list).toHaveBeenCalledTimes(2);
    await act(async () => {
      jest.advanceTimersByTime(REGION_POLL_MS * 3);
    });
    expect(mapRegionsApi.list).toHaveBeenCalledTimes(2);
  });

  it('does not offer a province a live region already has', async () => {
    const user = userEvent.setup();
    render(<MapRegionsPage />);
    await screen.findByRole('button', { name: 'İstanbul' });
    await user.click(screen.getByRole('button', { name: 'Bölge ekle' }));
    expect(await screen.findByRole('option', { name: 'İstanbul (var)' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Bursa' })).toBeEnabled();
  });

  it('asks again for a failed region', async () => {
    (mapRegionsApi.retry as jest.Mock).mockResolvedValue({ ...kocaeli, status: 'requested' });
    const user = userEvent.setup();
    render(<MapRegionsPage />);
    const panel = await open(user, 'Kocaeli');
    expect(within(panel).getByText('Kaynak okunamadı')).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Tekrar dene' }));
    expect(mapRegionsApi.retry).toHaveBeenCalledWith('r3');
    await waitFor(() =>
      expect(
        within(screen.getByRole('group', { name: 'Özet', hidden: true })).getByRole('button', {
          name: /Hazırlanıyor\s*2/,
          hidden: true,
        }),
      ).toBeInTheDocument(),
    );
  });

  it('asks a province by its box, the name following the province', async () => {
    (mapRegionsApi.list as jest.Mock).mockResolvedValue([]);
    (mapRegionsApi.request as jest.Mock).mockResolvedValue({
      ...istanbul,
      id: 'r9',
      name: 'Bursa',
      status: 'requested',
    });
    const user = userEvent.setup();
    render(<MapRegionsPage />);
    expect(await screen.findByText('Henüz bölge yok')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Bölge ekle' }));
    await user.selectOptions(await screen.findByLabelText('İl'), 'Bursa');
    expect(screen.getByLabelText('Ad')).toHaveValue('Bursa');
    await user.click(screen.getByRole('button', { name: 'Bölge iste' }));

    await waitFor(() => expect(mapRegionsApi.request).toHaveBeenCalledTimes(1));
    const body = (mapRegionsApi.request as jest.Mock).mock.calls[0][0];
    expect(body.name).toBe('Bursa');
    expect(body.bbox).toHaveLength(4);
    expect(body).not.toHaveProperty('maxZoom');
    expect(await screen.findByRole('button', { name: 'Bursa' })).toBeInTheDocument();
  });

  it('asks once more before a region as large as Türkiye', async () => {
    (mapRegionsApi.list as jest.Mock).mockResolvedValue([]);
    (mapRegionsApi.request as jest.Mock).mockResolvedValue({
      ...istanbul,
      id: 'r8',
      name: 'Türkiye',
      status: 'requested',
    });
    const user = userEvent.setup();
    render(<MapRegionsPage />);
    await user.click(await screen.findByRole('button', { name: 'Bölge ekle' }));
    await user.selectOptions(await screen.findByLabelText('İl'), 'Türkiye');
    expect(screen.getByText(/^Büyük bölge/)).toHaveAttribute('role', 'status');
    await user.click(screen.getByRole('button', { name: 'Bölge iste' }));
    expect(mapRegionsApi.request).not.toHaveBeenCalled();

    const dialog = await screen.findByRole('alertdialog', { name: /Türkiye.*büyük bir bölge/ });
    await user.click(within(dialog).getByRole('button', { name: 'Yine de iste' }));
    await waitFor(() =>
      expect(mapRegionsApi.request).toHaveBeenCalledWith({
        name: 'Türkiye',
        bbox: [25.66, 35.81, 44.83, 42.11],
      }),
    );
  });

  it("says core's refusal in the drawer", async () => {
    (mapRegionsApi.list as jest.Mock).mockResolvedValue([]);
    (mapRegionsApi.request as jest.Mock).mockRejectedValue(
      new ProblemError(409, 'Conflict', { code: 'map_region_exists' }),
    );
    const user = userEvent.setup();
    render(<MapRegionsPage />);
    await user.click(await screen.findByRole('button', { name: 'Bölge ekle' }));
    await user.type(await screen.findByLabelText('Ad'), 'Kutu');
    for (const [side, value] of [
      ['Batı', '28'],
      ['Güney', '40'],
      ['Doğu', '29'],
      ['Kuzey', '41'],
    ]) {
      await user.type(screen.getByLabelText(side), value);
    }
    await user.click(screen.getByRole('button', { name: 'Bölge iste' }));
    expect(await screen.findByText('Bu kutuda bir bölge zaten var.')).toBeInTheDocument();
    expect(mapRegionsApi.request).toHaveBeenCalledWith({ name: 'Kutu', bbox: [28, 40, 29, 41] });
  });

  it('retires a region after asking', async () => {
    (mapRegionsApi.retire as jest.Mock).mockResolvedValue({ ...istanbul, status: 'retired' });
    const user = userEvent.setup();
    render(<MapRegionsPage />);
    const panel = await open(user, 'İstanbul');
    await user.click(within(panel).getByRole('button', { name: 'Kaldır' }));
    const dialog = await screen.findByRole('alertdialog', { name: '"İstanbul" kaldırılsın mı?' });
    await user.click(within(dialog).getByRole('button', { name: 'Bölgeyi kaldır' }));
    await waitFor(() => expect(mapRegionsApi.retire).toHaveBeenCalledWith('r1'));
    expect((await screen.findAllByText('Kaldırıldı')).length).toBeGreaterThan(0);
  });

  it('tells anyone without media:manage that the page is not theirs', async () => {
    (mapRegionsApi.list as jest.Mock).mockRejectedValue(new ProblemError(403, 'Forbidden'));
    render(<MapRegionsPage />);
    expect(await screen.findByText('Bu sayfaya erişimin yok')).toBeInTheDocument();
  });

  it('shows the ready regions without a button to whoever core gives no media:manage', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'media.delete': false } });
    const user = userEvent.setup();
    render(<MapRegionsPage />);
    expect(await screen.findByRole('button', { name: 'İstanbul' })).toBeInTheDocument();
    await waitFor(() => expect(capabilitiesApi.get).toHaveBeenCalled());
    await act(async () => undefined);
    expect(screen.queryByRole('button', { name: 'Bölge ekle' })).not.toBeInTheDocument();
    await open(user, 'Kocaeli');
    expect(screen.queryByRole('button', { name: 'Kaldır' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tekrar dene' })).not.toBeInTheDocument();
  });
});
