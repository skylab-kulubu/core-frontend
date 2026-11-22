'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap, Marker, StyleSpecification } from 'maplibre-gl';
import type { MapRegion } from '@/lib/api/map-regions';
import { POINT_ZOOM, regionCenter, type LatLng } from '@/lib/event-location';

/** The club's purple: the pin core draws on the ticket's map too. */
const PIN_COLOR = '#8B5CF6';

/** The map files the panel serves itself (public/map/README.md). */
function assetUrl(path: string): string {
  return `${window.location.origin}/map/${path}`;
}

type MapLibre = typeof import('maplibre-gl');

let setup: Promise<MapLibre> | null = null;

/**
 * MapLibre with the `pmtiles://` protocol and its worker from the panel's
 * origin, set up once per page.
 */
function loadMapLibre(): Promise<MapLibre> {
  setup ??= Promise.all([import('maplibre-gl'), import('pmtiles')]).then(([maplibre, pmtiles]) => {
    maplibre.setWorkerUrl(assetUrl(`maplibre-gl-worker.mjs?v=${maplibre.getVersion()}`));
    const protocol = new pmtiles.Protocol();
    maplibre.addProtocol('pmtiles', protocol.tile);
    return maplibre;
  });
  return setup;
}

/** The Protomaps basemap's grey flavor over the region's archive, labels in Turkish. */
async function regionStyle(region: MapRegion): Promise<StyleSpecification> {
  const basemaps = await import('@protomaps/basemaps');
  return {
    version: 8,
    glyphs: assetUrl('fonts/{fontstack}/{range}.pbf'),
    sprite: assetUrl('sprites/grayscale'),
    sources: {
      protomaps: { type: 'vector', url: `pmtiles://${region.url}` },
    },
    layers: basemaps.layers('protomaps', basemaps.namedFlavor('grayscale'), { lang: 'tr' }),
  };
}

/** The region's box with some room around it: the map does not wander off its tiles. */
function looseBounds(region: MapRegion): [[number, number], [number, number]] {
  const [minLon, minLat, maxLon, maxLat] = region.bbox;
  const padLon = (maxLon - minLon) * 0.1;
  const padLat = (maxLat - minLat) * 0.1;
  return [
    [minLon - padLon, minLat - padLat],
    [maxLon + padLon, maxLat + padLat],
  ];
}

type LocationMapProps = {
  region: MapRegion;
  point: LatLng | null;
  onPoint: (point: LatLng) => void;
  /** The map could not be drawn (no WebGL after all, a style that failed). */
  onFailed?: () => void;
};

/**
 * The point picker: a click puts the pin, the pin drags. Loaded on its own
 * (next/dynamic) so only the pages that show it load MapLibre.
 */
export default function LocationMap({ region, point, onPoint, onFailed }: LocationMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const latest = useRef({ point, onPoint, onFailed });
  latest.current = { point, onPoint, onFailed };
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    void (async () => {
      try {
        const [maplibre, style] = await Promise.all([loadMapLibre(), regionStyle(region)]);
        if (cancelled || !container.current) return;
        const start = regionCenter(region, latest.current.point);
        const created = new maplibre.Map({
          container: container.current,
          style,
          center: [start.lng, start.lat],
          zoom: POINT_ZOOM,
          maxBounds: looseBounds(region),
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
        });
        created.addControl(
          new maplibre.NavigationControl({ showCompass: false, visualizePitch: false }),
          'top-right',
        );
        created.touchZoomRotate.disableRotation();
        const pin = new maplibre.Marker({ color: PIN_COLOR, draggable: true });
        pin.on('dragend', () => {
          const at = pin.getLngLat();
          latest.current.onPoint({ lat: at.lat, lng: at.lng });
        });
        created.on('click', (event) => {
          latest.current.onPoint({ lat: event.lngLat.lat, lng: event.lngLat.lng });
        });
        created.once('load', () => {
          if (!cancelled) setReady(true);
        });
        map.current = created;
        marker.current = pin;
        const current = latest.current.point;
        if (current) pin.setLngLat([current.lng, current.lat]).addTo(created);
      } catch {
        if (!cancelled) latest.current.onFailed?.();
      }
    })();
    return () => {
      cancelled = true;
      marker.current?.remove();
      map.current?.remove();
      marker.current = null;
      map.current = null;
    };
  }, [region]);

  // A point from outside the map (a place chosen, the pin taken off) moves the pin
  const lat = point?.lat;
  const lng = point?.lng;
  useEffect(() => {
    const created = map.current;
    const pin = marker.current;
    if (!created || !pin) return;
    if (lat === undefined || lng === undefined) {
      pin.remove();
      return;
    }
    pin.setLngLat([lng, lat]).addTo(created);
    if (!created.getBounds().contains([lng, lat])) {
      created.easeTo({ center: [lng, lat], zoom: Math.max(created.getZoom(), 14) });
    }
  }, [lat, lng, ready]);

  return (
    <div
      ref={container}
      className="border-border bg-muted h-56 w-full overflow-hidden rounded-md border"
      aria-label="Harita"
      role="application"
    />
  );
}
