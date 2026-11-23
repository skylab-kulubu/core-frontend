'use client';

import dynamic from 'next/dynamic';
import { useEffect, useId, useMemo, useState } from 'react';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { Select } from '@/components/chrome/Select';
import { eventsApi, type EventPlace } from '@/lib/api/events';
import { mapRegionsApi, readyMapRegions, type MapRegion } from '@/lib/api/map-regions';
import {
  filterPlaces,
  formatPoint,
  LOCATION_ADDRESS_MAX,
  MAP_ATTRIBUTION,
  MAP_ATTRIBUTION_URL,
  namesChosen,
  placePatch,
  pointOf,
  pointPatch,
  regionHolding,
  renamePatch,
  startRegion,
  webglAvailable,
  type EventLocationValue,
  type LatLng,
} from '@/lib/event-location';

const LocationMap = dynamic(() => import('./LocationMap'), {
  ssr: false,
  loading: () => <div className="border-border bg-muted h-56 w-full rounded-md border" />,
});

type EventLocationFieldsProps = {
  value: EventLocationValue;
  onChange: (patch: Partial<EventLocationValue>) => void;
  /** The places offered are this team's; none: the club's (event:manage). */
  ownerTeam?: string;
  required?: boolean;
  placeholder?: string;
};

/** The regions the picker shows, read once per page; none when they cannot be read. */
let regionsRead: Promise<MapRegion[]> | null = null;

function readRegions(): Promise<MapRegion[]> {
  regionsRead ??= Promise.resolve()
    .then(() => mapRegionsApi.list())
    .then(readyMapRegions)
    .catch(() => {
      regionsRead = null;
      return [];
    });
  return regionsRead;
}

/** Test hook: forget the regions read. */
export function resetMapRegionsCache() {
  regionsRead = null;
}

/**
 * An Event's place (core docs/event-location.md): its name, offered from the
 * places of earlier Events; its street address; and, while the club has a
 * ready map region and the browser draws WebGL, its point on the map. With no
 * map, the name and the address alone.
 */
export function EventLocationFields({
  value,
  onChange,
  ownerTeam = '',
  required = true,
  placeholder = 'YTÜ Davutpaşa',
}: EventLocationFieldsProps) {
  const id = useId();
  const listId = `${id}-places`;
  const [places, setPlaces] = useState<EventPlace[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [regions, setRegions] = useState<MapRegion[]>([]);
  const [regionUrl, setRegionUrl] = useState('');
  const [mapFailed, setMapFailed] = useState(false);
  const [webgl, setWebgl] = useState(false);
  // The place last chosen from the list, until the name lets go of it
  const [chosen, setChosen] = useState<EventLocationValue | null>(null);
  const team = ownerTeam.trim();

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve()
      .then(() => eventsApi.places(team || undefined))
      .then((rows) => {
        if (!cancelled) setPlaces(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setPlaces([]);
      });
    return () => {
      cancelled = true;
    };
  }, [team]);

  useEffect(() => {
    let cancelled = false;
    void readRegions().then((rows) => {
      if (cancelled) return;
      setRegions(rows);
      // Asked only when there is a map to draw
      if (rows.length) setWebgl(webglAvailable());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const lat = value.locationLat;
  const lng = value.locationLng;
  const point = useMemo(
    () => pointOf({ location: '', locationLat: lat, locationLng: lng }),
    [lat, lng],
  );
  const suggestions = useMemo(() => filterPlaces(places, value.location), [places, value.location]);
  const showList = open && suggestions.length > 0;

  const region = useMemo(() => {
    const chosen = regions.find((row) => row.url === regionUrl);
    if (chosen) return chosen;
    return startRegion(regions, point);
  }, [regions, regionUrl, point]);

  // The map stays on the region it opened with; a click elsewhere does not switch it
  useEffect(() => {
    if (!regionUrl && region?.url) setRegionUrl(region.url);
  }, [region, regionUrl]);
  const showMap = webgl && !mapFailed && region !== null;

  function choose(place: EventPlace) {
    const patch = placePatch(place);
    onChange(patch);
    setChosen(patch);
    const holding = regionHolding(regions, { lat: patch.locationLat, lng: patch.locationLng });
    if (holding?.url) setRegionUrl(holding.url);
    setOpen(false);
    setActive(-1);
  }

  function setPoint(next: LatLng | null) {
    onChange(pointPatch(next));
  }

  return (
    <div className="space-y-3">
      <div className="relative space-y-1">
        <label htmlFor={`${id}-name`} className="block">
          <FieldLabel>Konum</FieldLabel>
        </label>
        <Field
          id={`${id}-name`}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={value.location}
          required={required}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onChange={(e) => {
            const name = e.target.value;
            onChange(renamePatch(value, chosen, name));
            if (!namesChosen(chosen, name)) setChosen(null);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(e) => {
            if (!suggestions.length) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((index) => (index + 1) % suggestions.length);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setOpen(true);
              setActive((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
            } else if (e.key === 'Enter' && showList && active >= 0) {
              e.preventDefault();
              choose(suggestions[active]);
            } else if (e.key === 'Escape') {
              setOpen(false);
              setActive(-1);
            }
          }}
        />
        {showList ? (
          <ul
            id={listId}
            role="listbox"
            aria-label="Önceki yerler"
            className="border-border bg-popover text-popover-foreground shadow-overlay absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-lg border py-1"
          >
            {suggestions.map((place, index) => (
              <li
                key={`${place.name}|${place.lat}|${place.lng}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                // Chosen before the field's blur closes the list
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(place);
                }}
                className={`cursor-pointer px-3 py-1.5 ${index === active ? 'bg-accent' : 'hover:bg-accent'}`}
              >
                <span className="text-secondary-foreground block truncate text-sm">
                  {place.name}
                </span>
                {place.address ? (
                  <span className="text-subtle-foreground block truncate text-[13px]/5">
                    {place.address}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <label className="block space-y-1">
        <FieldLabel>Açık adres</FieldLabel>
        <Field
          value={value.locationAddress ?? ''}
          maxLength={LOCATION_ADDRESS_MAX}
          placeholder="Davutpaşa Cd. No:127, Esenler/İstanbul"
          onChange={(e) => onChange({ locationAddress: e.target.value })}
        />
      </label>
      {showMap && region ? (
        <div className="space-y-1">
          {regions.length > 1 ? (
            <Select
              aria-label="Harita bölgesi"
              className="w-48"
              value={region.url ?? ''}
              onChange={(e) => setRegionUrl(e.target.value)}
            >
              {regions.map((row) => (
                <option key={row.url} value={row.url}>
                  {row.name}
                </option>
              ))}
            </Select>
          ) : null}
          <LocationMap
            region={region}
            point={point}
            onPoint={setPoint}
            onFailed={() => setMapFailed(true)}
          />
          <div className="text-subtle-foreground flex flex-wrap items-center justify-between gap-2 text-[13px]/5">
            <a
              href={MAP_ATTRIBUTION_URL}
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground"
            >
              {MAP_ATTRIBUTION}
            </a>
            {point ? (
              <span className="flex items-center gap-2">
                <span className="tabular-nums">{formatPoint(point)}</span>
                <button
                  type="button"
                  onClick={() => setPoint(null)}
                  className="text-skylab-300 hover:bg-accent rounded-md px-2 py-0.5"
                >
                  Noktayı kaldır
                </button>
              </span>
            ) : null}
          </div>
        </div>
      ) : point ? (
        // No map (no WebGL, no ready region, tiles that would not load): the point stays in sight
        <div className="text-subtle-foreground flex flex-wrap items-center gap-2 text-[13px]/5">
          <span className="tabular-nums">Nokta: {formatPoint(point)}</span>
          <button
            type="button"
            onClick={() => setPoint(null)}
            className="text-skylab-300 hover:bg-accent rounded-md px-2 py-0.5"
          >
            Kaldır
          </button>
        </div>
      ) : null}
    </div>
  );
}
