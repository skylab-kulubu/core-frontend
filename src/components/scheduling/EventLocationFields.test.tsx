import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import {
  EventLocationFields,
  resetMapRegionsCache,
} from '@/components/scheduling/EventLocationFields';
import { eventsApi } from '@/lib/api/events';
import { mapRegionsApi } from '@/lib/api/map-regions';
import type { EventLocationValue } from '@/lib/event-location';

jest.mock('@/lib/api/events', () => ({ eventsApi: { places: jest.fn() } }));
jest.mock('@/lib/api/map-regions', () => ({
  ...jest.requireActual('@/lib/api/map-regions'),
  mapRegionsApi: { list: jest.fn() },
}));
jest.mock('@/lib/event-location', () => ({
  ...jest.requireActual('@/lib/event-location'),
  webglAvailable: () => true,
}));
// MapLibre needs WebGL: the map is a button that drops a pin at one point
jest.mock('@/components/scheduling/LocationMap', () => ({
  __esModule: true,
  default: ({
    region,
    point,
    onPoint,
  }: {
    region: { name: string };
    point: { lat: number; lng: number } | null;
    onPoint: (point: { lat: number; lng: number }) => void;
  }) => (
    <button type="button" onClick={() => onPoint({ lat: 41.0412345678, lng: 28.9912345678 })}>
      {`harita ${region.name} ${point ? `${point.lat},${point.lng}` : 'boş'}`}
    </button>
  ),
}));

const places = [
  {
    name: 'YTÜ Davutpaşa, EEF Konferans Salonu',
    address: 'Davutpaşa Cd. No:127, Esenler',
    lat: 41.025376,
    lng: 28.889648,
    lastUsedAt: '2026-10-14T16:00:00Z',
    uses: 2,
  },
  {
    name: 'YTÜ Yıldız, Oditoryum',
    lat: 41.05046,
    lng: 29.01103,
    lastUsedAt: '2026-05-02T10:00:00Z',
    uses: 1,
  },
];

const istanbul = {
  id: 'r1',
  name: 'İstanbul',
  bbox: [27.95, 40.8, 29.95, 41.6],
  maxZoom: 15,
  status: 'ready',
  url: 'https://cdn.test/maps/istanbul.pmtiles',
};

let latest: EventLocationValue = { location: '' };

function Fields({ initial = { location: '' } }: { initial?: EventLocationValue }) {
  const [value, setValue] = useState<EventLocationValue>(initial);
  latest = value;
  return (
    <EventLocationFields
      value={value}
      ownerTeam="WEBLAB"
      onChange={(patch) => setValue((current) => ({ ...current, ...patch }))}
    />
  );
}

describe('EventLocationFields', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMapRegionsCache();
    (eventsApi.places as jest.Mock).mockResolvedValue(places);
    (mapRegionsApi.list as jest.Mock).mockResolvedValue([istanbul]);
  });

  it("offers the team's earlier places and fills name, address and point from one", async () => {
    const user = userEvent.setup();
    render(<Fields />);
    await waitFor(() => expect(eventsApi.places).toHaveBeenCalledWith('WEBLAB'));

    await user.type(screen.getByRole('combobox', { name: 'Konum' }), 'yıldız');
    const option = await screen.findByRole('option', { name: /YTÜ Yıldız, Oditoryum/ });
    expect(screen.queryByRole('option', { name: /EEF/ })).not.toBeInTheDocument();
    await user.click(option);

    expect(latest).toEqual({
      location: 'YTÜ Yıldız, Oditoryum',
      locationAddress: '',
      locationLat: 41.05046,
      locationLng: 29.01103,
    });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(await screen.findByText('41.050460, 29.011030')).toBeInTheDocument();
  });

  it('chooses a place with the keyboard', async () => {
    const user = userEvent.setup();
    render(<Fields />);
    const field = screen.getByRole('combobox', { name: 'Konum' });
    await user.click(field);
    await screen.findByRole('listbox');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(latest.location).toBe('YTÜ Davutpaşa, EEF Konferans Salonu');
    expect(latest.locationAddress).toBe('Davutpaşa Cd. No:127, Esenler');
  });

  it('keeps a typed name with no place and an address of its own', async () => {
    const user = userEvent.setup();
    render(<Fields />);
    await user.type(screen.getByRole('combobox', { name: 'Konum' }), 'Online');
    await user.type(screen.getByLabelText('Açık adres'), 'Esenler');
    expect(latest).toEqual({ location: 'Online', locationAddress: 'Esenler' });
    expect(screen.getByLabelText('Açık adres')).toHaveAttribute('maxLength', '300');
  });

  it('puts the pin where the map is clicked, rounded, and takes it off', async () => {
    const user = userEvent.setup();
    render(<Fields initial={{ location: 'Salon' }} />);
    await user.click(await screen.findByRole('button', { name: 'harita İstanbul boş' }));
    expect(latest.locationLat).toBe(41.041235);
    expect(latest.locationLng).toBe(28.991235);
    expect(screen.getByRole('link', { name: '© OpenStreetMap contributors' })).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/copyright',
    );

    await user.click(screen.getByRole('button', { name: 'Noktayı kaldır' }));
    expect(latest.locationLat).toBeUndefined();
    expect(latest.locationLng).toBeUndefined();
  });

  it('shows the address alone while the club has no ready region', async () => {
    (mapRegionsApi.list as jest.Mock).mockResolvedValue([
      { ...istanbul, status: 'extracting', url: undefined },
    ]);
    render(<Fields />);
    await waitFor(() => expect(mapRegionsApi.list).toHaveBeenCalled());
    await act(async () => undefined);
    expect(screen.getByLabelText('Açık adres')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /harita/ })).not.toBeInTheDocument();
  });

  it('offers nothing when the places cannot be read (403), the field still types', async () => {
    (eventsApi.places as jest.Mock).mockRejectedValue(new Error('403'));
    (mapRegionsApi.list as jest.Mock).mockRejectedValue(new Error('404'));
    const user = userEvent.setup();
    render(<Fields />);
    await user.type(screen.getByRole('combobox', { name: 'Konum' }), 'YTÜ');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(latest.location).toBe('YTÜ');
  });
});
