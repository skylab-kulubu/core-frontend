import { ProblemError } from '@/lib/api/core';
import { coreProblemMessage } from '@/lib/core-problems';

/** core's map region refusals (docs/event-map.md, "Regions"). */
const MAP_REGION_MESSAGES: Record<string, string> = {
  map_region_invalid: 'Ad 1–80 karakter, kutu en çok Türkiye’nin dört katı olmalı.',
  map_region_exists: 'Bu kutuda bir bölge zaten var.',
  map_region_state: 'Bölge bu durumda değiştirilemez.',
};

export function mapRegionProblem(error: unknown, fallback: string): string {
  if (error instanceof ProblemError && error.code && MAP_REGION_MESSAGES[error.code]) {
    return MAP_REGION_MESSAGES[error.code];
  }
  return coreProblemMessage(error, fallback);
}
