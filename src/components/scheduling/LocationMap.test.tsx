import { render, waitFor } from '@testing-library/react';
import React from 'react';
import LocationMap from '@/components/scheduling/LocationMap';

type Handler = (event: Record<string, unknown>) => void;

// MapLibre needs WebGL: a map that records its handlers, so a test can fire them
const mockMaps: {
  handlers: Record<string, Handler[]>;
  fire: (type: string, event?: object) => void;
}[] = [];

jest.mock(
  'maplibre-gl',
  () => {
    class FakeMap {
      handlers: Record<string, Handler[]> = {};
      touchZoomRotate = { disableRotation: jest.fn() };
      constructor() {
        mockMaps.push(this);
      }
      on(type: string, handler: Handler) {
        (this.handlers[type] ??= []).push(handler);
        return this;
      }
      once(type: string, handler: Handler) {
        return this.on(type, handler);
      }
      fire(type: string, event: object = {}) {
        for (const handler of this.handlers[type] ?? []) handler(event as Record<string, unknown>);
      }
      addControl() {
        return this;
      }
      remove() {}
    }
    class FakeMarker {
      on() {
        return this;
      }
      setLngLat() {
        return this;
      }
      addTo() {
        return this;
      }
      remove() {}
    }
    return {
      __esModule: true,
      getVersion: () => '6.17.0',
      setWorkerUrl: jest.fn(),
      addProtocol: jest.fn(),
      Map: FakeMap,
      Marker: FakeMarker,
      NavigationControl: class {},
    };
    // The package exports ESM alone, which jest does not resolve: mocked by name
  },
  { virtual: true },
);
jest.mock(
  'pmtiles',
  () => ({
    Protocol: class {
      tile = jest.fn();
    },
  }),
  { virtual: true },
);
jest.mock('@protomaps/basemaps', () => ({ layers: () => [], namedFlavor: () => ({}) }), {
  virtual: true,
});

const istanbul = {
  name: 'İstanbul',
  bbox: [27.95, 40.8, 29.95, 41.6] as [number, number, number, number],
  maxZoom: 15,
  url: 'https://cdn.test/maps/istanbul.pmtiles',
};

async function drawn(onFailed: jest.Mock) {
  render(<LocationMap region={istanbul} point={null} onPoint={jest.fn()} onFailed={onFailed} />);
  await waitFor(() => expect(mockMaps).toHaveLength(1));
  return mockMaps[0];
}

describe('LocationMap', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    mockMaps.length = 0;
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => consoleError.mockRestore());

  it('gives up when the archive cannot be read (no CORS, gone)', async () => {
    const onFailed = jest.fn();
    const map = await drawn(onFailed);
    map.fire('error', { error: new Error('Failed to fetch'), sourceId: 'protomaps' });
    map.fire('error', { error: new Error('again'), sourceId: 'protomaps' });
    expect(onFailed).toHaveBeenCalledTimes(1);
  });

  it('gives up when its first tiles fail, not on a tile that fails later', async () => {
    const first = jest.fn();
    const map = await drawn(first);
    map.fire('error', { error: new Error('tile'), sourceId: 'protomaps', tile: {} });
    expect(first).toHaveBeenCalledTimes(1);

    mockMaps.length = 0;
    const later = jest.fn();
    const shown = await drawn(later);
    shown.fire('load');
    shown.fire('error', { error: new Error('tile'), sourceId: 'protomaps', tile: {} });
    expect(later).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });

  it('keeps the map on an error of something else (a sprite)', async () => {
    const onFailed = jest.fn();
    const map = await drawn(onFailed);
    map.fire('error', { error: new Error('sprite') });
    expect(onFailed).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(new Error('sprite'));
  });
});
