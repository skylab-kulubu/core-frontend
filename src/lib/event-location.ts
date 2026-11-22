import type { EventPlace } from '@/lib/api/events';
import type { MapRegion } from '@/lib/api/map-regions';

/** A point on the map, WGS 84 degrees. */
export type LatLng = { lat: number; lng: number };

/** The place fields of an Event's form (core docs/event-location.md). */
export type EventLocationValue = {
  location: string;
  locationAddress?: string;
  locationLat?: number;
  locationLng?: number;
};

/** The most core keeps of an address. */
export const LOCATION_ADDRESS_MAX = 300;

/** The credit OpenStreetMap's data asks for under every map (ODbL). */
export const MAP_ATTRIBUTION = '© OpenStreetMap contributors';
export const MAP_ATTRIBUTION_URL = 'https://www.openstreetmap.org/copyright';

/** Where the picker opens without a point: YTÜ Davutpaşa, when a region holds it. */
export const DEFAULT_POINT: LatLng = { lat: 41.0255, lng: 28.8895 };

/** The zoom the picker shows a point at. */
export const POINT_ZOOM = 15;

/** core keeps six decimals (about 11 cm); the picker sends no more. */
export function roundCoord(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** The form's point, when it has one (both coordinates, as core keeps them). */
export function pointOf(value: EventLocationValue): LatLng | null {
  const { locationLat: lat, locationLng: lng } = value;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** The form fields a point sets; `null` takes the point off. */
export function pointPatch(
  point: LatLng | null,
): Pick<EventLocationValue, 'locationLat' | 'locationLng'> {
  if (!point) return { locationLat: undefined, locationLng: undefined };
  return { locationLat: roundCoord(point.lat), locationLng: roundCoord(point.lng) };
}

/** `41.025376, 28.889648` */
export function formatPoint(point: LatLng): string {
  return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
}

function fold(text: string): string {
  return text.toLocaleLowerCase('tr').normalize('NFC');
}

/**
 * The places offered under the place field as the organizer types: those
 * whose name or address holds what was typed, in core's order (the latest
 * used first). A name typed out in full offers nothing more.
 */
export function filterPlaces(
  places: readonly EventPlace[],
  query: string,
  limit = 6,
): EventPlace[] {
  const q = fold(query.trim());
  return places
    .filter((place) => {
      if (!q) return true;
      if (fold(place.name) === q) return false;
      return fold(place.name).includes(q) || fold(place.address ?? '').includes(q);
    })
    .slice(0, limit);
}

/** A chosen place fills the four fields together (core docs/event-location.md). */
export function placePatch(place: EventPlace): Required<EventLocationValue> {
  return {
    location: place.name,
    locationAddress: place.address ?? '',
    locationLat: roundCoord(place.lat),
    locationLng: roundCoord(place.lng),
  };
}

function holds(region: MapRegion, point: LatLng): boolean {
  const [minLon, minLat, maxLon, maxLat] = region.bbox;
  return point.lng >= minLon && point.lng <= maxLon && point.lat >= minLat && point.lat <= maxLat;
}

function area(region: MapRegion): number {
  const [minLon, minLat, maxLon, maxLat] = region.bbox;
  return (maxLon - minLon) * (maxLat - minLat);
}

/** The smallest region that holds the point, as core draws it; none outside them all. */
export function regionHolding(regions: readonly MapRegion[], point: LatLng): MapRegion | null {
  return (
    [...regions].filter((region) => holds(region, point)).sort((a, b) => area(a) - area(b))[0] ??
    null
  );
}

/** The region the picker opens on: the point's, else Davutpaşa's, else the first. */
export function startRegion(regions: readonly MapRegion[], point: LatLng | null): MapRegion | null {
  if (!regions.length) return null;
  return (
    (point && regionHolding(regions, point)) ||
    regionHolding(regions, DEFAULT_POINT) ||
    regions[0] ||
    null
  );
}

/** Where the map looks first in a region: the point, Davutpaşa when it holds it, or its middle. */
export function regionCenter(region: MapRegion, point: LatLng | null): LatLng {
  if (point && holds(region, point)) return point;
  if (holds(region, DEFAULT_POINT)) return DEFAULT_POINT;
  const [minLon, minLat, maxLon, maxLat] = region.bbox;
  return { lat: (minLat + maxLat) / 2, lng: (minLon + maxLon) / 2 };
}

/** Whether this browser can draw the map (MapLibre needs WebGL). */
export function webglAvailable(doc: Document | undefined = globalThis.document): boolean {
  if (!doc) return false;
  try {
    const canvas = doc.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
