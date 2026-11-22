import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import MapRegionsPage, { REGION_POLL_MS } from '@/app/(authorized)/map-regions/page';
import { ProblemError } from '@/lib/api/core';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { mapRegionsApi, type MapRegion } from '@/lib/api/map-regions';

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
    (mapRegionsApi.list as jest.Mock).mockResolvedValue([ankara, kocaeli, istanbul]);
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'media.delete': true } });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('lists the regions with status, size and progress', async () => {
    render(<MapRegionsPage />);
    expect(await screen.findByText('İstanbul')).toBeInTheDocument();
    expect(screen.getByText(/75,0 MB · yapım 20261122/)).toBeInTheDocument();
    expect(screen.getByText('Hazır')).toBeInTheDocument();
    expect(screen.getByText('Hazırlanıyor')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Ankara hazırlanıyor' })).toHaveAttribute(
      'aria-valuenow',
      '25',
    );
    expect(screen.getByText(/Kaynak okunamadı/)).toBeInTheDocument();
    expect(screen.getByText('Hata')).toBeInTheDocument();
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
    await screen.findByText('İstanbul');
    await user.click(screen.getByRole('button', { name: 'Bölge ekle' }));
    expect(await screen.findByRole('option', { name: 'İstanbul (var)' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Bursa' })).toBeEnabled();
  });

  it('asks again for a failed region', async () => {
    (mapRegionsApi.retry as jest.Mock).mockResolvedValue({ ...kocaeli, status: 'requested' });
    const user = userEvent.setup();
    render(<MapRegionsPage />);
    await screen.findByText('Kocaeli');
    await user.click(screen.getByRole('button', { name: 'Tekrar dene' }));
    expect(mapRegionsApi.retry).toHaveBeenCalledWith('r3');
    await waitFor(() => expect(screen.getAllByText('Hazırlanıyor')).toHaveLength(2));
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
    expect(await screen.findByText('Bölge yok')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Bölge ekle' }));
    await user.selectOptions(await screen.findByLabelText('İl'), 'Bursa');
    expect(screen.getByLabelText('Ad')).toHaveValue('Bursa');
    await user.click(screen.getByRole('button', { name: 'Bölge iste' }));

    await waitFor(() => expect(mapRegionsApi.request).toHaveBeenCalledTimes(1));
    const body = (mapRegionsApi.request as jest.Mock).mock.calls[0][0];
    expect(body.name).toBe('Bursa');
    expect(body.bbox).toHaveLength(4);
    expect(body).not.toHaveProperty('maxZoom');
    expect(await screen.findByText('Bursa')).toBeInTheDocument();
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
    await screen.findByText('İstanbul');
    const buttons = screen.getAllByRole('button', { name: 'Kaldır' });
    await user.click(buttons[buttons.length - 1]);
    const dialog = await screen.findByRole('alertdialog', { name: '"İstanbul" kaldırılsın mı?' });
    await user.click(within(dialog).getByRole('button', { name: 'Bölgeyi kaldır' }));
    await waitFor(() => expect(mapRegionsApi.retire).toHaveBeenCalledWith('r1'));
    expect(await screen.findByText('Kaldırıldı')).toBeInTheDocument();
  });

  it('tells anyone without media:manage that the page is not theirs', async () => {
    (mapRegionsApi.list as jest.Mock).mockRejectedValue(new ProblemError(403, 'Forbidden'));
    render(<MapRegionsPage />);
    expect(await screen.findByText('Bu sayfa ADMIN ve YK’ya açık')).toBeInTheDocument();
  });

  it('shows the ready regions without a button to whoever core gives no media:manage', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'media.delete': false } });
    render(<MapRegionsPage />);
    expect(await screen.findByText('İstanbul')).toBeInTheDocument();
    await waitFor(() => expect(capabilitiesApi.get).toHaveBeenCalled());
    await act(async () => undefined);
    expect(screen.queryByRole('button', { name: 'Bölge ekle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kaldır' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tekrar dene' })).not.toBeInTheDocument();
  });
});
