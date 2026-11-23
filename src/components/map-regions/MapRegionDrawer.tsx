'use client';

import { useState } from 'react';
import { Drawer } from '@/components/chrome/Drawer';
import { useDirtySince } from '@/lib/ui/use-unsaved-changes';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Select } from '@/components/chrome/Select';
import { mapRegionsApi, type MapRegion } from '@/lib/api/map-regions';
import { isLargeRegion, parseBBox, type BBox } from '@/lib/map-regions-ui';
import { PROVINCE_BOXES, TURKIYE_BOX } from '@/lib/province-boxes';
import { useConfirm } from '@/lib/ui/use-confirm';
import { mapRegionProblem } from './map-region-problems';

const SIDES = ['Batı', 'Güney', 'Doğu', 'Kuzey'] as const;
const EMPTY_SIDES = ['', '', '', ''];

/** The box as the fields show it: dots, as a map gives degrees. */
function boxFields(box: BBox): string[] {
  return box.map((value) => String(value));
}

type MapRegionDrawerProps = {
  open: boolean;
  onClose: () => void;
  onRequested: (region: MapRegion) => void;
  /** The names of the live regions: their province is not offered again. */
  taken?: readonly string[];
};

/**
 * "Bölge ekle": a name and a box, the box filled from a province (or
 * Türkiye) or typed. core extracts it from the latest Protomaps build.
 */
export function MapRegionDrawer({ open, onClose, onRequested, taken = [] }: MapRegionDrawerProps) {
  const [confirm, confirmDialog] = useConfirm();
  const [name, setName] = useState('');
  const [source, setSource] = useState('');
  const [sides, setSides] = useState<string[]>(EMPTY_SIDES);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const parsed = parseBBox(sides);
  const dirty = useDirtySince(open, { name, source, sides });
  const large = 'box' in parsed && isLargeRegion(parsed.box);

  function reset() {
    setName('');
    setSource('');
    setSides(EMPTY_SIDES);
    setError(null);
  }

  function pick(value: string) {
    const previous = source;
    setSource(value);
    const box =
      value === 'Türkiye' ? TURKIYE_BOX : PROVINCE_BOXES.find((row) => row.name === value)?.bbox;
    if (!box) return;
    setSides(boxFields(box));
    // A name the reader did not type follows the province
    if (!name.trim() || name === previous) setName(value);
  }

  async function send(box: BBox) {
    setPending(true);
    setError(null);
    try {
      const region = await mapRegionsApi.request({ name: name.trim(), bbox: box });
      reset();
      onRequested(region);
      onClose();
    } catch (err) {
      setError(mapRegionProblem(err, 'Bölge istenemedi'));
      throw err;
    } finally {
      setPending(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Bölge ekle"
      dirty={dirty}
    >
      <form
        className="space-y-3"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) {
            setError('Ad gerekli.');
            return;
          }
          if ('error' in parsed) {
            setError(parsed.error);
            return;
          }
          if (large) {
            const box = parsed.box;
            confirm({
              title: `"${name.trim()}" büyük bir bölge. İstensin mi?`,
              description: 'Çıkarım uzun sürer ve core’un belleğini zorlayabilir.',
              actionLabel: 'Yine de iste',
              destructive: false,
              closesDrawer: true,
              failure: (err) => mapRegionProblem(err, 'Bölge istenemedi'),
              onConfirm: () => send(box),
            });
            return;
          }
          void send(parsed.box).catch(() => undefined);
        }}
      >
        <label className="block space-y-1">
          <FieldLabel>İl</FieldLabel>
          <Select value={source} onChange={(e) => pick(e.target.value)}>
            <option value="">Elle kutu</option>
            {[{ name: 'Türkiye' }, ...PROVINCE_BOXES].map((row) => (
              <option key={row.name} value={row.name} disabled={taken.includes(row.name)}>
                {taken.includes(row.name) ? `${row.name} (var)` : row.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="block space-y-1">
          <FieldLabel>Ad</FieldLabel>
          <Field value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          {SIDES.map((side, index) => (
            <label key={side} className="block space-y-1">
              <FieldLabel>{side}</FieldLabel>
              <Field
                inputMode="decimal"
                value={sides[index]}
                placeholder={index % 2 === 0 ? 'boylam' : 'enlem'}
                onChange={(e) => {
                  const next = [...sides];
                  next[index] = e.target.value;
                  setSides(next);
                  setSource('');
                }}
              />
            </label>
          ))}
        </div>
        {large ? (
          <p role="status" className="text-warning text-[13px]/5">
            Büyük bölge: çıkarım core’un belleğini zorlayabilir; boyutu core sınırlar.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        <SaveButton pending={pending}>Bölge iste</SaveButton>
      </form>
      {confirmDialog}
    </Drawer>
  );
}
