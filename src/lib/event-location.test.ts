/** @jest-environment node */

import type { EventPlace } from '@/lib/api/events';
import type { MapRegion } from '@/lib/api/map-regions';
import { readyMapRegions } from '@/lib/api/map-regions';
import {
  DEFAULT_POINT,
  filterPlaces,
  formatPoint,
  placePatch,
  pointOf,
  pointPatch,
  regionCenter,
  regionHolding,
  roundCoord,
  startRegion,
} from '@/lib/event-location';

const place = (name: string, address?: string, lat = 41.025376, lng = 28.889648): EventPlace => ({
  name,
  address,
  lat,
  lng,
  lastUsedAt: '2026-10-14T16:00:00Z',
  uses: 1,
});

const istanbul: MapRegion = {
  name: 'İstanbul',
  bbox: [27.95, 40.8, 29.95, 41.6],
  maxZoom: 15,
  status: 'ready',
  url: 'https://cdn.test/maps/istanbul.pmtiles',
};
const kampus: MapRegion = {
  name: 'Davutpaşa',
  bbox: [28.87, 41.01, 28.9, 41.04],
  maxZoom: 15,
  status: 'ready',
  url: 'https://cdn.test/maps/davutpasa.pmtiles',
};
const ankara: MapRegion = {
  name: 'Ankara',
  bbox: [32.4, 39.7, 33.1, 40.1],
  maxZoom: 15,
  status: 'ready',
  url: 'https://cdn.test/maps/ankara.pmtiles',
};

describe('event location', () => {
  it('rounds a point to the six decimals core keeps', () => {
    expect(roundCoord(41.02537649)).toBe(41.025376);
    expect(pointPatch({ lat: 41.0253769, lng: 28.8896481 })).toEqual({
      locationLat: 41.025377,
      locationLng: 28.889648,
    });
    expect(pointPatch(null)).toEqual({ locationLat: undefined, locationLng: undefined });
    expect(formatPoint({ lat: 41.0255, lng: 28.8895 })).toBe('41.025500, 28.889500');
  });

  it('has a point only with both coordinates', () => {
    expect(pointOf({ location: 'x', locationLat: 41, locationLng: 29 })).toEqual({
      lat: 41,
      lng: 29,
    });
    expect(pointOf({ location: 'x', locationLat: 41 })).toBeNull();
    expect(pointOf({ location: 'x' })).toBeNull();
  });

  it('offers the places whose name or address holds what was typed, Turkish case', () => {
    const places = [
      place('YTÜ Davutpaşa, EEF Konferans Salonu', 'Davutpaşa Cd. No:127, Esenler'),
      place('İTÜ Ayazağa', 'Maslak, Sarıyer'),
      place('Kodlama Evi', 'Esenler'),
    ];
    expect(filterPlaces(places, '').map((row) => row.name)).toHaveLength(3);
    expect(filterPlaces(places, 'itü').map((row) => row.name)).toEqual(['İTÜ Ayazağa']);
    expect(filterPlaces(places, 'esenler').map((row) => row.name)).toEqual([
      'YTÜ Davutpaşa, EEF Konferans Salonu',
      'Kodlama Evi',
    ]);
    // A name typed out in full offers nothing more
    expect(filterPlaces(places, 'kodlama evi')).toEqual([]);
    expect(filterPlaces(places, '', 2)).toHaveLength(2);
  });

  it('fills the four fields from a chosen place', () => {
    expect(placePatch(place('Salon', undefined, 41.1234567, 29.7654321))).toEqual({
      location: 'Salon',
      locationAddress: '',
      locationLat: 41.123457,
      locationLng: 29.765432,
    });
  });

  it('draws a point from the smallest ready region that holds it', () => {
    const regions = [istanbul, kampus, ankara];
    expect(regionHolding(regions, DEFAULT_POINT)?.name).toBe('Davutpaşa');
    expect(regionHolding(regions, { lat: 41.05, lng: 29.01 })?.name).toBe('İstanbul');
    expect(regionHolding(regions, { lat: 38.4, lng: 27.1 })).toBeNull();
  });

  it('opens on the point, else Davutpaşa, else the first region', () => {
    expect(startRegion([], null)).toBeNull();
    expect(startRegion([istanbul, ankara], { lat: 39.9, lng: 32.8 })?.name).toBe('Ankara');
    expect(startRegion([ankara, istanbul], null)?.name).toBe('İstanbul');
    expect(startRegion([ankara], null)?.name).toBe('Ankara');
    const middle = regionCenter(ankara, null);
    expect(middle.lat).toBeCloseTo(39.9);
    expect(middle.lng).toBeCloseTo(32.75);
    expect(regionCenter(istanbul, null)).toEqual(DEFAULT_POINT);
    expect(regionCenter(istanbul, { lat: 41.05, lng: 29.01 })).toEqual({ lat: 41.05, lng: 29.01 });
  });

  it('shows only the ready regions with an address', () => {
    expect(
      readyMapRegions([
        istanbul,
        { ...ankara, status: 'extracting', url: undefined },
        { ...kampus, status: 'failed' },
        { name: 'Okur', bbox: [1, 1, 2, 2], maxZoom: 15, url: 'https://cdn.test/okur.pmtiles' },
      ]).map((row) => row.name),
    ).toEqual(['İstanbul', 'Okur']);
  });
});
