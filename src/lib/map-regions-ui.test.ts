/** @jest-environment node */

import {
  bboxArea,
  formatBBox,
  formatRegionBytes,
  isLargeRegion,
  parseBBox,
  regionErrorLabel,
  regionProgress,
  regionsInProgress,
  regionStatus,
} from '@/lib/map-regions-ui';
import { PROVINCE_BOXES, TURKIYE_BOX } from '@/lib/province-boxes';

describe('map regions', () => {
  it('names each status and failure', () => {
    expect(regionStatus('requested').label).toBe('Hazırlanıyor');
    expect(regionStatus('extracting').label).toBe('Hazırlanıyor');
    expect(regionStatus('ready')).toEqual({ kind: 'active', label: 'Hazır' });
    expect(regionStatus('failed')).toEqual({ kind: 'cancelled', label: 'Hata' });
    expect(regionStatus('retired').label).toBe('Kaldırıldı');
    expect(regionErrorLabel('too_large')).toBe('Boyut sınırını aşıyor');
    expect(regionErrorLabel('something_new')).toBe('Çıkarım başarısız');
  });

  it('says sizes and progress in Turkish', () => {
    expect(formatRegionBytes(78_643_200)).toBe('75,0 MB');
    expect(formatRegionBytes(1_717_986_918)).toBe('1,6 GB');
    expect(formatRegionBytes(2048)).toBe('2 KB');
    expect(formatRegionBytes(undefined)).toBe('');
    const base = { name: 'x', bbox: [0, 0, 1, 1] as [number, number, number, number], maxZoom: 15 };
    expect(
      regionProgress({ ...base, status: 'extracting', sizeBytes: 200, progressBytes: 50 }),
    ).toBe(25);
    expect(regionProgress({ ...base, status: 'extracting', progressBytes: 50 })).toBeNull();
    expect(
      regionProgress({ ...base, status: 'ready', sizeBytes: 200, progressBytes: 200 }),
    ).toBeNull();
    expect(regionsInProgress([{ ...base, status: 'ready' }])).toBe(false);
    expect(
      regionsInProgress([
        { ...base, status: 'ready' },
        { ...base, status: 'requested' },
      ]),
    ).toBe(true);
  });

  it('reads a typed box and refuses a crossed, out-of-range or too large one', () => {
    expect(parseBBox(['27.95', '40,80', '29.95', '41.6'])).toEqual({
      box: [27.95, 40.8, 29.95, 41.6],
    });
    expect(parseBBox(['', '40', '29', '41'])).toHaveProperty('error');
    expect(parseBBox(['29', '40', '28', '41'])).toEqual({
      error: 'Batı doğudan, güney kuzeyden küçük olmalı.',
    });
    expect(parseBBox(['-200', '40', '28', '41'])).toHaveProperty('error');
    expect(parseBBox(['-60', '-40', '60', '40'])).toEqual({
      error: 'Kutu en çok Türkiye’nin dört katı olabilir.',
    });
    expect(formatBBox([27.95, 40.8, 29.95, 41.6])).toBe('27,95 – 29,95 · 40,80 – 41,60');
  });

  it('asks again for Türkiye, not for a province', () => {
    expect(isLargeRegion(TURKIYE_BOX)).toBe(true);
    expect(isLargeRegion([27.95, 40.8, 29.95, 41.6])).toBe(false);
    for (const province of PROVINCE_BOXES) {
      expect([province.name, isLargeRegion(province.bbox)]).toEqual([province.name, false]);
    }
    expect(bboxArea([29, 41, 28, 42])).toBe(0);
  });

  it('has the 81 provinces, each box inside Türkiye’s', () => {
    expect(PROVINCE_BOXES).toHaveLength(81);
    expect(new Set(PROVINCE_BOXES.map((row) => row.name)).size).toBe(81);
    const [w, s, e, n] = TURKIYE_BOX;
    for (const { name, bbox } of PROVINCE_BOXES) {
      const [minLon, minLat, maxLon, maxLat] = bbox;
      expect([name, minLon < maxLon && minLat < maxLat]).toEqual([name, true]);
      expect([
        name,
        minLon >= w - 0.5 && maxLon <= e + 0.5 && minLat >= s - 0.5 && maxLat <= n + 0.5,
      ]).toEqual([name, true]);
    }
    expect(PROVINCE_BOXES.find((row) => row.name === 'İstanbul')).toBeDefined();
  });
});
