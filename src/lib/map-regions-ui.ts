import type { MapRegion, MapRegionStatus } from '@/lib/api/map-regions';
import type { StatusChipKind } from '@/lib/status-chip';

export type BBox = [number, number, number, number];

/** A region's status as the list shows it. */
export function regionStatus(status: MapRegionStatus | undefined): {
  kind: StatusChipKind;
  label: string;
} {
  switch (status) {
    case 'requested':
    case 'extracting':
      return { kind: 'pending', label: 'Hazırlanıyor' };
    case 'failed':
      return { kind: 'cancelled', label: 'Hata' };
    case 'retired':
      return { kind: 'neutral', label: 'Kaldırıldı' };
    default:
      return { kind: 'active', label: 'Hazır' };
  }
}

/** Why a region failed (core's `errorCode`). */
const ERROR_LABELS: Record<string, string> = {
  source_unavailable: 'Kaynak okunamadı',
  schema_mismatch: 'Kaynağın şeması uyuşmuyor',
  too_large: 'Boyut sınırını aşıyor',
  empty: 'Kutuda veri yok',
  upload_failed: 'Yükleme başarısız',
  failed: 'Çıkarım başarısız',
};

export function regionErrorLabel(code: string | undefined): string {
  return (code && ERROR_LABELS[code]) || ERROR_LABELS.failed;
}

/** While one is asked for or being extracted, the list reads itself again. */
export function regionsInProgress(regions: readonly MapRegion[]): boolean {
  return regions.some((region) => region.status === 'requested' || region.status === 'extracting');
}

/** `75,0 MB`, `1,6 GB` */
export function formatRegionBytes(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '';
  const mib = bytes / (1024 * 1024);
  if (mib >= 1024) return `${(mib / 1024).toFixed(1).replace('.', ',')} GB`;
  if (mib >= 1) return `${mib.toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** How far an extract is, 0–100; none before core knows its size. */
export function regionProgress(region: MapRegion): number | null {
  if (region.status !== 'extracting' || !region.sizeBytes) return null;
  const done = Math.min(region.progressBytes ?? 0, region.sizeBytes);
  return Math.round((done / region.sizeBytes) * 100);
}

/** A box in square degrees. */
export function bboxArea([minLon, minLat, maxLon, maxLat]: BBox): number {
  return Math.max(0, maxLon - minLon) * Math.max(0, maxLat - minLat);
}

/**
 * Above this the request is asked again: more than any one province (Konya's
 * box is about 8), several times İstanbul's (1,6; about 75 MB). Türkiye's
 * box (about 121, 1,6 GB) is extracted in core's own process, whose memory
 * has not been measured for it yet.
 */
export const LARGE_REGION_AREA = 12;

export function isLargeRegion(box: BBox): boolean {
  return bboxArea(box) > LARGE_REGION_AREA;
}

/** core's bound: four times Türkiye's box (mapregion.MaxArea). */
export const MAX_REGION_AREA = 4 * 19.17 * 6.3;

/** The box as typed, or why it cannot be sent. */
export function parseBBox(fields: readonly string[]): { box: BBox } | { error: string } {
  const numbers = fields.map((field) => Number(field.trim().replace(',', '.')));
  if (fields.some((field) => !field.trim()) || numbers.some((n) => !Number.isFinite(n))) {
    return { error: 'Kutunun dört kenarı sayı olmalı.' };
  }
  const [minLon, minLat, maxLon, maxLat] = numbers;
  if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90) {
    return { error: 'Boylam −180…180, enlem −90…90 arasında olmalı.' };
  }
  if (minLon >= maxLon || minLat >= maxLat) {
    return { error: 'Batı doğudan, güney kuzeyden küçük olmalı.' };
  }
  const box: BBox = [minLon, minLat, maxLon, maxLat];
  if (bboxArea(box) > MAX_REGION_AREA) {
    return { error: 'Kutu en çok Türkiye’nin dört katı olabilir.' };
  }
  return { box };
}

/** `27,95 – 29,95 · 40,80 – 41,60` (boylam · enlem) */
export function formatBBox([minLon, minLat, maxLon, maxLat]: BBox): string {
  const n = (value: number) => value.toFixed(2).replace('.', ',');
  return `${n(minLon)} – ${n(maxLon)} · ${n(minLat)} – ${n(maxLat)}`;
}
