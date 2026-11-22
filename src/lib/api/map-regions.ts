import { coreFetch } from './core';

/** Where a map region is (core docs/event-map.md, "Regions"). */
export type MapRegionStatus = 'requested' | 'extracting' | 'ready' | 'failed' | 'retired';

/**
 * One of the club's map regions: an OpenStreetMap extract (PMTiles) in the
 * public bucket. A reader without media:manage gets the ready ones alone,
 * with their name, box, zoom and `url`.
 */
export type MapRegion = {
  id?: string;
  name: string;
  /** min lon, min lat, max lon, max lat */
  bbox: [number, number, number, number];
  maxZoom: number;
  status?: MapRegionStatus;
  sizeBytes?: number;
  progressBytes?: number;
  sourceBuild?: string;
  /** The extract's public address, once ready. */
  url?: string;
  errorCode?: string;
  createdAt?: string;
  readyAt?: string;
};

export type MapRegionRequest = {
  name: string;
  bbox: [number, number, number, number];
  maxZoom?: number;
};

export const mapRegionsApi = {
  /** Every region for media:manage (ADMIN, YK); the ready ones for anyone signed in. */
  /** Polled while a region is extracted, so never from the kept reads. */
  list: () => coreFetch<MapRegion[]>('/v1/map-regions', { cache: 'no-store' }),
  /** 202 `requested`; `400 map_region_invalid`, `409 map_region_exists`. */
  request: (body: MapRegionRequest) =>
    coreFetch<MapRegion>('/v1/map-regions', { method: 'POST', body: JSON.stringify(body) }),
  /** A failed region asked for again; another status is `409 map_region_state`. */
  retry: (id: string) =>
    coreFetch<MapRegion>(`/v1/map-regions/${encodeURIComponent(id)}/retry`, { method: 'POST' }),
  /** Stops using a region (its file stays); `409 map_region_state` when already retired. */
  retire: (id: string) =>
    coreFetch<MapRegion>(`/v1/map-regions/${encodeURIComponent(id)}/retire`, { method: 'POST' }),
};

/** The regions the point picker can show: ready, with an address. */
export function readyMapRegions(regions: readonly MapRegion[]): MapRegion[] {
  return regions.filter((region) => (region.status ?? 'ready') === 'ready' && Boolean(region.url));
}
