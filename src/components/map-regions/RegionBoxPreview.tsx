import type { BBox } from '@/lib/map-regions-ui';
import { TURKIYE_BOX } from '@/lib/province-boxes';

const WIDTH = 320;
const PAD = 0.6;

/**
 * Where the region's box lies, drawn against Türkiye's box: a sketch of its reach that needs no
 * map tiles, so it shows for a region still being prepared or one that failed too.
 */
export function RegionBoxPreview({ box, name }: { box: BBox; name: string }) {
  // The frame: Türkiye, widened to take in a box that reaches past it
  const minLon = Math.min(TURKIYE_BOX[0], box[0]) - PAD;
  const minLat = Math.min(TURKIYE_BOX[1], box[1]) - PAD;
  const maxLon = Math.max(TURKIYE_BOX[2], box[2]) + PAD;
  const maxLat = Math.max(TURKIYE_BOX[3], box[3]) + PAD;
  // Degrees of longitude shrink with latitude; at Türkiye's middle a degree east is ~0,77 of one north
  const squash = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const scale = WIDTH / ((maxLon - minLon) * squash);
  const height = Math.round((maxLat - minLat) * scale);
  const x = (lon: number) => (lon - minLon) * squash * scale;
  const y = (lat: number) => (maxLat - lat) * scale;
  const rect = (b: readonly number[]) => ({
    x: x(b[0]),
    y: y(b[3]),
    width: Math.max(6, x(b[2]) - x(b[0])),
    height: Math.max(6, y(b[1]) - y(b[3])),
  });
  const region = rect(box);
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      role="img"
      aria-label={`${name}: Türkiye içindeki kapsamı`}
      className="bg-muted/40 border-border-subtle w-full rounded-md border"
    >
      <rect
        {...rect(TURKIYE_BOX)}
        rx={4}
        fill="none"
        className="stroke-border-strong"
        strokeDasharray="4 3"
      />
      <text
        x={x(TURKIYE_BOX[0]) + 6}
        y={y(TURKIYE_BOX[3]) + 14}
        className="fill-subtle-foreground"
        fontSize={11}
      >
        Türkiye
      </text>
      <rect {...region} rx={2} className="fill-skylab-400/30 stroke-skylab-300" strokeWidth={1.5} />
    </svg>
  );
}
